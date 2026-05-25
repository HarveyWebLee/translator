import { Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../../../config/app-config.service';
import { ModelCatalog } from '../catalog/model.catalog';

import type { SimpleTranslator } from '@translator/llm-core';
import type { ProviderDescriptor } from '@translator/shared-types';

@Injectable()
export class LibreTranslateProvider implements SimpleTranslator {
  readonly id = 'libre-translate';
  private readonly logger = new Logger(LibreTranslateProvider.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly catalog: ModelCatalog,
  ) {}

  describe(): ProviderDescriptor {
    return this.catalog.all().find((p) => p.id === this.id)!;
  }

  async translate(text: string, opts: { source?: string; target: string }): Promise<string> {
    const baseUrl = this.config.get('LIBRE_TRANSLATE_BASE_URL');
    const apiKey = this.config.get('LIBRE_TRANSLATE_API_KEY');
    const res = await fetch(`${baseUrl}/translate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: opts.source ?? 'auto',
        target: opts.target,
        format: 'text',
        api_key: apiKey || undefined,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`LibreTranslate 调用失败: ${res.status} ${errText.slice(0, 200)}`);
    }
    const data = (await res.json()) as { translatedText?: string };
    return data.translatedText ?? '';
  }
}
