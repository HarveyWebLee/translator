# @translator/server

翻译扩展的 NestJS 后端，负责：

- 用户鉴权（邮箱+密码，JWT/Refresh）
- 会员体系（free / basic / premium）
- LLM 网关（DeepSeek / OpenAI / Anthropic / Ollama）
- 免费翻译引擎（Google 公开端点 / LibreTranslate，用户自选）
- 批量翻译 / 划词翻译 / SSE 流式翻译
- 用量配额与限流

## 本地启动

```bash
# 1. 启动数据库（PostgreSQL）
docker compose up -d

# 2. 复制环境变量
cp .env.example .env

# 3. 数据库迁移（Prisma 7，需 Node ≥ 20.19）
pnpm prisma:migrate

# 4. （可选）写入开发测试账号
pnpm prisma:seed
# free@dev.local / basic@dev.local / premium@dev.local，密码均为 dev-password-123

# 5. 启动开发服务（会自动 prisma generate；Client 源码在 src/generated/prisma 并已纳入版本库）
pnpm dev
```

默认端口：`http://localhost:19696`，Swagger 文档：`http://localhost:19696/docs`。

## 数据库（Prisma 7）

命令：`prisma:migrate` · `prisma:seed` · `prisma:generate` · `prisma:deploy` · `prisma:studio`。  
完整说明（Node ≥ 20.19、`ERR_REQUIRE_ESM` 排查、adapter 架构）见 [技术实现文档 §2.3.1](../../docs/技术实现文档.md#231-prisma-orm-7)。

## 关键路由

| 方法 | 路径                             | 说明                           |
| ---- | -------------------------------- | ------------------------------ |
| POST | `/auth/register`                 | 邮箱注册                       |
| POST | `/auth/login`                    | 邮箱登录                       |
| POST | `/auth/refresh`                  | 刷新 token                     |
| GET  | `/auth/me`                       | 当前用户信息                   |
| GET  | `/llm/models`                    | 获取当前会员等级可见的模型列表 |
| POST | `/translation/batch`             | 批量翻译                       |
| POST | `/translation/selection`         | 划词翻译                       |
| POST | `/translation/stream/session`    | 创建 SSE 流会话                |
| GET  | `/translation/stream/:sessionId` | SSE 流式翻译                   |
| POST | `/billing/subscribe`             | 升级订阅（骨架）               |

## OAuth / 短信骨架

本期仅提供 Controller / Service 骨架，三方 SDK 集成留 `// TODO`：

- 开发期短信验证码固定 `000000`
- OAuth 回调返回模拟用户，不真正请求 Google/GitHub API
