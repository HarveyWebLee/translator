import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { BillingService } from './billing.service';
import { SubscribeDto } from './dto/subscribe.dto';

@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('subscribe')
  subscribe(@CurrentUser() user: Express.User, @Body() dto: SubscribeDto) {
    return this.billingService.createSubscription(user.id, dto);
  }

  /**
   * 开发期/管理端：直接激活订阅。生产应改为受保护的运营后台或 webhook 驱动。
   */
  @Post('admin/activate/:subscriptionId')
  activate(@Param('subscriptionId') id: string) {
    return this.billingService.adminActivate(id);
  }
}
