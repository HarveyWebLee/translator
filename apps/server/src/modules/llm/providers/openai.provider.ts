import { Injectable } from '@nestjs/common';

import type { ProviderDescriptor } from '@translator/shared-types';

import { ModelCatalog } from '../catalog/model.catalog';

import { OpenAICompatibleProvider } from './openai-compatible.base';

@Injectable()
export class OpenAIProvider extends OpenAICompatibleProvider {
  readonly id = 'openai';
  protected readonly baseURL = undefined; // 走默认 https://api.openai.com/v1

  constructor(private readonly catalog: ModelCatalog) {
    super('OpenAIProvider');
  }

  describe(): ProviderDescriptor {
    return this.catalog.all().find((p) => p.id === this.id)!;
  }
}
