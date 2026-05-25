import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class SegmentDto {
  @ApiProperty()
  @IsInt()
  index!: number;

  @ApiProperty()
  @IsString()
  text!: string;
}

export class BatchTranslateDto {
  @ApiProperty()
  @IsString()
  providerId!: string;

  @ApiProperty()
  @IsString()
  modelId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userApiKey?: string;

  @ApiProperty({ type: [SegmentDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SegmentDto)
  segments!: SegmentDto[];

  @ApiProperty({ required: false, default: 'zh-CN' })
  @IsOptional()
  @IsString()
  targetLang?: string;
}
