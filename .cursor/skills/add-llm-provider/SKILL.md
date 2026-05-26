---
name: add-llm-provider
description: 接入一个新的 LLM 或免费翻译引擎到本项目。当用户提出「新增 / 接入 / 集成 XX 模型」「支持 XX Provider」「加一个新的 LLM」等需求时使用，自动覆盖 provider 实现、模型目录注册、模块装配、env 校验、文档更新等全流程。
---

# 接入新 LLM Provider

## 何时使用

用户表达类似「我想加上 xxx 模型 / yyy 翻译服务」或「接入 Mistral / 通义 / 智谱」时触发。

## 标准流程（必须按顺序执行）

### 1. 决定归类

询问或推断：

- **是 OpenAI 兼容 API？** → 继承 `openai-compatible.base.ts`
- **是免费翻译 SDK？** → 继承 `SimpleTranslator` 抽象（参考 `google-free.provider.ts`）
- **完全私有协议？** → 直接实现 `LlmProvider` 接口

### 2. tier × keySource 矩阵

确认这个 provider 对应哪一档：

| 场景                      | keySource | tier      |
| ------------------------- | --------- | --------- |
| 免费公开端点              | `none`    | `free`    |
| 用户自带 Key 的通用 LLM   | `user`    | `basic`   |
| 开发者赞助 Key 的高级模型 | `system`  | `premium` |

### 3. 落地代码

```bash
apps/server/src/modules/llm/
├── providers/<name>.provider.ts     # 新建：实现 LlmProvider
├── catalog/model.catalog.ts          # 修改：注册模型条目
└── llm.module.ts                     # 修改：providers 数组登记
```

模型条目模板：

```ts
{
  id: 'mistral-large',
  label: 'Mistral Large',
  providerId: 'mistral',
  tier: 'basic',
  keySource: 'user',
  capabilities: ['chat', 'stream', 'translation'],
  priceHint: '约 ¥0.02/1K tokens',
}
```

### 4. 配置 env（仅 keySource === 'system' 时）

```bash
# apps/server/.env.example
MISTRAL_API_KEY=
```

同步更新 `apps/server/src/config/env.validation.ts` 的 zod schema。

### 5. 文档更新

- `apps/server/README.md` 的 Provider 列表
- `docs/技术实现文档.md` 的「LLM 接入」表格
- `docs/需求功能文档.md` 的会员能力对照表（如新增免费引擎）

### 6. 验证

```bash
pnpm --filter @translator/server typecheck
pnpm --filter @translator/server lint
pnpm --filter @translator/server build
```

### 7. 前端联调

前端 `ModelsTab` 会自动通过 `/llm/models` 拉取并渲染，**不需要**改前端代码。验证：

- 用 free 账号登录：新模型不应出现（若 tier > free）
- 用 basic 账号登录：新模型出现，但 keySource=system 的应灰显
- 用 premium 账号登录：全部出现

## 反模式

- ❌ 在 provider 内 `process.env.XXX_KEY`（应注入 `AppConfigService`）
- ❌ 跳过 `model.catalog.ts` 直接 hardcode 在 controller 里
- ❌ 实现 `chat()` 但不实现 `chatStream()`（用户体验会退化为整体返回）
- ❌ 把高 tier 模型的 keySource 设成 `user`（会绕过会员限制）

## 参考实现

| 类型           | 看这个文件                              |
| -------------- | --------------------------------------- |
| OpenAI 兼容    | `providers/deepseek.provider.ts`        |
| Anthropic 协议 | `providers/anthropic.provider.ts`       |
| 本地 Ollama    | `providers/ollama.provider.ts`          |
| 免费 SDK       | `providers/google-free.provider.ts`     |
| 自建服务       | `providers/libre-translate.provider.ts` |
