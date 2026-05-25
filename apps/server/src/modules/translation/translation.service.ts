import { Injectable, Logger } from '@nestjs/common';
import { Tier } from '@prisma/client';

import { LlmService } from '../llm/llm.service';
import { ProviderRegistry } from '../llm/registry/provider.registry';
import { QuotaService } from '../quota/quota.service';

import {
  SYSTEM_PROMPT_BATCH,
  SYSTEM_PROMPT_SELECTION,
  SYSTEM_PROMPT_SINGLE,
  parseJsonArray,
  sanitizeTranslation,
} from './prompts';

import type { BatchTranslateDto } from './dto/batch.dto';
import type { SelectionTranslateDto } from './dto/selection.dto';
import type {
  TranslateBatchResponse,
  TranslateSelectionResponse,
  TranslateStreamEvent,
} from '@translator/shared-types';

const MAX_ITEMS_PER_BATCH = 15;
const MAX_CHARS_PER_BATCH = 3500;

interface ChunkRange {
  start: number;
  end: number;
}

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  constructor(
    private readonly llm: LlmService,
    private readonly registry: ProviderRegistry,
    private readonly quota: QuotaService,
  ) {}

  /** 批量翻译入口 */
  async batch(userId: string, tier: Tier, dto: BatchTranslateDto): Promise<TranslateBatchResponse> {
    const totalChars = dto.segments.reduce((a, s) => a + s.text.length, 0);
    await this.quota.assertWithinQuota(userId, tier, totalChars);

    const model = this.llm.resolveModel(dto.modelId);
    const translations = new Array<string>(dto.segments.length).fill('');

    if (model.keySource === 'none') {
      // 免费引擎：逐段调用（无 JSON 协议）
      await this.simpleTranslateAll(dto, translations);
    } else {
      // LLM JSON 批量
      await this.llmTranslateAll(dto, translations);
    }

    await this.quota.record({
      userId,
      tier,
      providerId: model.providerId,
      modelId: model.id,
      chars: totalChars,
    });

    return { translations, usedChars: totalChars };
  }

  /** 划词翻译 */
  async selection(
    userId: string,
    tier: Tier,
    dto: SelectionTranslateDto,
  ): Promise<TranslateSelectionResponse> {
    const chars = dto.text.length + (dto.context?.length ?? 0);
    await this.quota.assertWithinQuota(userId, tier, chars);

    const model = this.llm.resolveModel(dto.modelId);

    if (model.keySource === 'none') {
      // 免费引擎降级：仅提供译文，词典字段留空
      const zh = await this.llm.translateSimple(dto.modelId, dto.text);
      return {
        term: dto.text,
        phonetic: '',
        partOfSpeech: '',
        briefDefinition: zh,
        exampleEn: '',
        exampleZh: '',
        contextExplanation: zh,
      };
    }

    const raw = await this.llm.chat({
      providerId: model.providerId,
      modelId: model.id,
      userApiKey: dto.userApiKey,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_SELECTION },
        {
          role: 'user',
          content: `划选英文：\n${dto.text}\n\n网页上下文（节选）：\n${(dto.context ?? '').slice(0, 800)}`,
        },
      ],
      temperature: 0.3,
      responseFormat: 'json_object',
    });

    await this.quota.record({
      userId,
      tier,
      providerId: model.providerId,
      modelId: model.id,
      chars,
    });

    return this.parseSelectionResult(raw.content, dto.text);
  }

  /** SSE 流：分块翻译并按段产出事件 */
  async *batchStream(
    userId: string,
    tier: Tier,
    dto: BatchTranslateDto,
  ): AsyncIterable<TranslateStreamEvent> {
    const totalChars = dto.segments.reduce((a, s) => a + s.text.length, 0);
    try {
      await this.quota.assertWithinQuota(userId, tier, totalChars);
    } catch (e) {
      yield { type: 'error', message: (e as Error).message };
      return;
    }

    const model = this.llm.resolveModel(dto.modelId);

    // 免费引擎无流式，降级为逐段返回
    if (model.keySource === 'none') {
      for (const seg of dto.segments) {
        try {
          const zh = await this.llm.translateSimple(dto.modelId, seg.text);
          yield { type: 'segment-done', segmentIndex: seg.index, text: zh };
        } catch (e) {
          yield { type: 'error', message: (e as Error).message };
        }
      }
      yield { type: 'done', usedChars: totalChars };
      await this.quota.record({
        userId,
        tier,
        providerId: model.providerId,
        modelId: model.id,
        chars: totalChars,
      });
      return;
    }

    // LLM 流式：分批 JSON 数组，每批 chatStream 时按段聚合
    const chunks = this.chunkSegments(dto.segments);
    for (const range of chunks) {
      const sub = dto.segments.slice(range.start, range.end);
      const payload = JSON.stringify(sub.map((s) => s.text));
      const userPrompt = `以下 JSON 数组共 ${sub.length} 段英文，请按相同顺序返回 ${sub.length} 段中文，仅输出 JSON 数组：\n${payload}`;

      let buf = '';
      try {
        for await (const chunk of this.llm.chatStream({
          providerId: model.providerId,
          modelId: model.id,
          userApiKey: dto.userApiKey,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT_BATCH },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
        })) {
          buf += chunk.delta;
        }
      } catch (e) {
        yield { type: 'error', message: (e as Error).message };
        continue;
      }

      const parsed = parseJsonArray(buf, sub.length);
      if (parsed) {
        for (let i = 0; i < sub.length; i++) {
          const seg = sub[i]!;
          yield {
            type: 'segment-done',
            segmentIndex: seg.index,
            text: parsed[i] || sanitizeTranslation(seg.text),
          };
        }
      } else {
        // 解析失败：原样返回，避免阻塞流
        for (const seg of sub) {
          yield {
            type: 'segment-done',
            segmentIndex: seg.index,
            text: sanitizeTranslation(seg.text),
          };
        }
      }
    }

    await this.quota.record({
      userId,
      tier,
      providerId: model.providerId,
      modelId: model.id,
      chars: totalChars,
    });
    yield { type: 'done', usedChars: totalChars };
  }

  // ---------- 私有：免费引擎逐段 ----------
  private async simpleTranslateAll(dto: BatchTranslateDto, out: string[]): Promise<void> {
    for (let i = 0; i < dto.segments.length; i++) {
      const seg = dto.segments[i]!;
      try {
        out[i] = await this.llm.translateSimple(dto.modelId, seg.text, dto.targetLang ?? 'zh-CN');
      } catch (e) {
        this.logger.warn(`免费翻译失败: ${(e as Error).message}`);
        out[i] = sanitizeTranslation(seg.text);
      }
    }
  }

  // ---------- 私有：LLM JSON 批量 ----------
  private async llmTranslateAll(dto: BatchTranslateDto, out: string[]): Promise<void> {
    const chunks = this.chunkSegments(dto.segments);
    for (const range of chunks) {
      const sub = dto.segments.slice(range.start, range.end);
      if (sub.length === 1) {
        const r = await this.llm.chat({
          providerId: dto.providerId,
          modelId: dto.modelId,
          userApiKey: dto.userApiKey,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT_SINGLE },
            { role: 'user', content: `请将以下英文翻译为简体中文：\n\n${sub[0]!.text}` },
          ],
        });
        out[range.start] = sanitizeTranslation(r.content);
        continue;
      }

      const payload = JSON.stringify(sub.map((s) => s.text));
      const r = await this.llm.chat({
        providerId: dto.providerId,
        modelId: dto.modelId,
        userApiKey: dto.userApiKey,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_BATCH },
          {
            role: 'user',
            content: `以下 JSON 数组共 ${sub.length} 段英文，请按相同顺序返回 ${sub.length} 段中文，仅输出 JSON 数组：\n${payload}`,
          },
        ],
        temperature: 0.2,
      });

      const parsed = parseJsonArray(r.content, sub.length);
      if (parsed) {
        for (let i = 0; i < sub.length; i++) {
          out[range.start + i] = parsed[i] ?? sanitizeTranslation(sub[i]!.text);
        }
      } else {
        // 解析失败：降级逐段
        for (let i = 0; i < sub.length; i++) {
          const single = await this.llm.chat({
            providerId: dto.providerId,
            modelId: dto.modelId,
            userApiKey: dto.userApiKey,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT_SINGLE },
              { role: 'user', content: `请将以下英文翻译为简体中文：\n\n${sub[i]!.text}` },
            ],
          });
          out[range.start + i] = sanitizeTranslation(single.content);
        }
      }
    }
  }

  // ---------- 私有：分块策略 ----------
  private chunkSegments(segments: { text: string }[]): ChunkRange[] {
    const ranges: ChunkRange[] = [];
    let start = 0;
    let count = 0;
    let chars = 0;
    for (let i = 0; i < segments.length; i++) {
      const t = segments[i]!.text.length + 50;
      if (count >= MAX_ITEMS_PER_BATCH || chars + t > MAX_CHARS_PER_BATCH) {
        if (count > 0) {
          ranges.push({ start, end: i });
          start = i;
          count = 0;
          chars = 0;
        }
      }
      count++;
      chars += t;
    }
    if (count > 0) ranges.push({ start, end: segments.length });
    return ranges;
  }

  private parseSelectionResult(raw: string, fallback: string): TranslateSelectionResponse {
    let s = raw.trim();
    const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
    if (fence) s = fence[1]!.trim();
    const objMatch = s.match(/\{[\s\S]*\}/);
    if (objMatch) s = objMatch[0];

    try {
      const data = JSON.parse(s) as Partial<TranslateSelectionResponse>;
      return {
        term: data.term || fallback,
        phonetic: data.phonetic || '',
        partOfSpeech: data.partOfSpeech || '',
        briefDefinition: data.briefDefinition || '',
        exampleEn: data.exampleEn || '',
        exampleZh: data.exampleZh || '',
        contextExplanation: data.contextExplanation || data.briefDefinition || '',
      };
    } catch {
      return {
        term: fallback,
        phonetic: '',
        partOfSpeech: '',
        briefDefinition: raw,
        exampleEn: '',
        exampleZh: '',
        contextExplanation: raw,
      };
    }
  }
}
