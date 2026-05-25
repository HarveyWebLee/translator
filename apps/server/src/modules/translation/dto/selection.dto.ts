import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SelectionTranslateDto {
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

  @ApiProperty()
  @IsString()
  @MaxLength(800)
  text!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  context?: string;
}
