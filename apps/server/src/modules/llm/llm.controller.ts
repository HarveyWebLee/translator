import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import type { MembershipTier } from '@translator/shared-types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { ModelCatalog } from './catalog/model.catalog';

@ApiTags('llm')
@ApiBearerAuth()
@Controller('llm')
export class LlmController {
  constructor(private readonly catalog: ModelCatalog) {}

  /** 返回当前用户等级可见的模型矩阵 */
  @Get('models')
  models(@CurrentUser() user: Express.User) {
    const tier = user.tier.toLowerCase() as MembershipTier;
    return { providers: this.catalog.forTier(tier), userTier: tier };
  }
}
