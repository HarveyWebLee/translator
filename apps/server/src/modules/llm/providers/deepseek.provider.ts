import { Injectable } from '@nestjs/common';

import type { ProviderDescriptor } from '@translator/shared-types';

import { ModelCatalog } from '../catalog/model.catalog';

import { OpenAICompatibleProvider } from './openai-compatible.base';

@Injectable()
export class DeepSeekProvider extends OpenAICompatibleProvider {
  readonly id = 'deepseek';
  protected readonly baseURL = 'https://api.deepseek.com/v1';

  constructor(private readonly catalog: ModelCatalog) {
    super('DeepSeekProvider');
  }

  describe(): ProviderDescriptor {
    return this.catalog.all().find((p) => p.id === this.id)!;
  }
}
