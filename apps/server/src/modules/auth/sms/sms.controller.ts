import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

import { Public } from '../../../common/decorators/public.decorator';

import { SmsService } from './sms.service';

class SendSmsDto {
  @Matches(/^\+?\d{6,15}$/, { message: '手机号格式错误' })
  phone!: string;
}

class VerifySmsDto {
  @Matches(/^\+?\d{6,15}$/)
  phone!: string;

  @IsString()
  code!: string;
}

@ApiTags('auth')
@Controller('auth/sms')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  @Public()
  @Post('send')
  @HttpCode(HttpStatus.OK)
  send(@Body() dto: SendSmsDto) {
    return this.smsService.sendCode(dto.phone);
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() dto: VerifySmsDto) {
    await this.smsService.verifyCode(dto.phone, dto.code);
    // TODO: 调用 AuthService.loginByPhone(...) 返回 tokens
    return { ok: true, note: '短信验证通过；登录签发逻辑待对接 AuthService' };
  }
}
