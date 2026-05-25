import { Injectable, Logger } from '@nestjs/common';
import translate from 'google-translate-api-x';

import { ModelCatalog } from '../catalog/model.catalog';

import type { SimpleTranslator } from '@translator/llm-core';
import type { ProviderDescriptor } from '@translator/shared-types';

/**
 * Google 翻译公开端点：通过 google-translate-api-x 包装。
 * 注意：非官方公开端点存在反爬风险，免费会员的兜底引擎之一。
 */
@Injectable()
export class GoogleFreeProvider implements SimpleTranslator {
  readonly id = 'google-free';
  private readonly logger = new Logger(GoogleFreeProvider.name);

  constructor(private readonly catalog: ModelCatalog) {}

  describe(): ProviderDescriptor {
    return this.catalog.all().find((p) => p.id === this.id)!;
  }

  async translate(text: string, opts: { source?: string; target: string }): Promise<string> {
    try {
      const result = await translate(text, {
        from: opts.source ?? 'auto',
        to: opts.target,
      });
      return Array.isArray(result) ? result.map((r) => r.text).join('') : result.text;
    } catch (e) {
      this.logger.warn(`Google 公开端点调用失败: ${(e as Error).message}`);
      throw new Error('Google 公开端点暂时不可用，请改用 LibreTranslate');
    }
  }
}
