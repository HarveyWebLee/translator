import { Injectable } from '@nestjs/common';

import { ModelCatalog } from '../catalog/model.catalog';

import { OpenAICompatibleProvider } from './openai-compatible.base';

import type { ProviderDescriptor } from '@translator/shared-types';

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
