import { Body, Controller, Param, Post, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

import type { TranslateStreamEvent } from '@translator/shared-types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { BatchTranslateDto } from './dto/batch.dto';
import { SelectionTranslateDto } from './dto/selection.dto';
import { SseSessionService } from './sse-session.service';
import { TranslationService } from './translation.service';

@ApiTags('translation')
@ApiBearerAuth()
@Controller('translation')
export class TranslationController {
  constructor(
    private readonly service: TranslationService,
    private readonly sessions: SseSessionService,
  ) {}

  @Post('batch')
  async batch(@CurrentUser() user: Express.User, @Body() dto: BatchTranslateDto) {
    return this.service.batch(user.id, user.tier, dto);
  }

  @Post('selection')
  async selection(@CurrentUser() user: Express.User, @Body() dto: SelectionTranslateDto) {
    return this.service.selection(user.id, user.tier, dto);
  }

  /**
   * SSE 流会话创建：客户端先 POST 此接口，拿到 sessionId；
   * 再 GET /translation/stream/:sessionId 通过 EventSource/fetch+ReadableStream 消费流。
   */
  @Post('stream/session')
  async createStreamSession(@CurrentUser() user: Express.User, @Body() dto: BatchTranslateDto) {
    const sessionId = await this.sessions.create(user.id, dto);
    return { sessionId };
  }

  /**
   * SSE 流端点。JWT 通过 ?token=... 携带（扩展环境 EventSource 不支持 header；
   * 也可改用 fetch + ReadableStream 走 Authorization）。
   */
  @Sse('stream/:sessionId')
  async stream(
    @CurrentUser() user: Express.User,
    @Param('sessionId') sessionId: string,
  ): Promise<Observable<{ data: TranslateStreamEvent }>> {
    const dto = await this.sessions.consume(sessionId, user.id);
    return from(this.service.batchStream(user.id, user.tier, dto)).pipe(
      map((evt) => ({ data: evt })),
    );
  }
}
