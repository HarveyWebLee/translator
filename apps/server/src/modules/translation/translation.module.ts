import { Module } from '@nestjs/common';

import { LlmModule } from '../llm/llm.module';

import { SseSessionService } from './sse-session.service';
import { TranslationController } from './translation.controller';
import { TranslationService } from './translation.service';

@Module({
  imports: [LlmModule],
  controllers: [TranslationController],
  providers: [TranslationService, SseSessionService],
})
export class TranslationModule {}
