import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import type { BatchTranslateDto } from './dto/batch.dto';

const SESSION_TTL_MS = 60 * 1000;

/**
 * SSE 会话存储：客户端先 POST 创建会话拿到 id，再 GET /translation/stream/:id 触发流式翻译。
 * 这样可以避免在 URL 中传递长 segments 与 userApiKey。
 */
@Injectable()
export class SseSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, payload: BatchTranslateDto): Promise<string> {
    const session = await this.prisma.streamSession.create({
      data: {
        userId,
        providerId: payload.providerId,
        modelId: payload.modelId,
        payload: payload as unknown as object,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
    return session.id;
  }

  async consume(sessionId: string, userId: string): Promise<BatchTranslateDto> {
    const s = await this.prisma.streamSession.findUnique({ where: { id: sessionId } });
    if (!s) throw new NotFoundException('会话不存在或已消费');
    if (s.userId !== userId) throw new UnauthorizedException('会话不属于当前用户');
    if (s.consumedAt) throw new NotFoundException('会话已消费');
    if (s.expiresAt < new Date()) throw new NotFoundException('会话已过期');

    await this.prisma.streamSession.update({
      where: { id: sessionId },
      data: { consumedAt: new Date() },
    });
    return s.payload as unknown as BatchTranslateDto;
  }
}
