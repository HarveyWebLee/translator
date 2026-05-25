import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SubscribeDto {
  @ApiProperty({ enum: ['BASIC', 'PREMIUM'] })
  @IsEnum(['BASIC', 'PREMIUM'])
  tier!: 'BASIC' | 'PREMIUM';

  @ApiProperty({ description: '订阅时长（天）', minimum: 1, maximum: 366 })
  @IsInt()
  @Min(1)
  @Max(366)
  durationDays!: number;

  @ApiProperty({ required: false, enum: ['stripe', 'alipay', 'wechat', 'mock'] })
  @IsOptional()
  @IsString()
  provider?: string;
}
