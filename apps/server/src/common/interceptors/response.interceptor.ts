import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * 统一非流式接口的响应格式：{ ok: true, data }。
 * SSE 路由通过 @SkipResponseWrap() 跳过（见 decorators）。
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ url: string }>();
    // SSE 与 swagger 静态路径不包装
    if (req.url.startsWith('/translation/stream/') || req.url.startsWith('/docs')) {
      return next.handle();
    }
    return next.handle().pipe(map((data) => ({ ok: true, data })));
  }
}
