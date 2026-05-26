# AI 翻译助手（Monorepo）

> 浏览器扩展 + NestJS 后端，提供英文网页**整页流式翻译**、**划词翻译**与**多 LLM/免费翻译引擎切换**。基于会员等级（免费 / 初级 / 高级）控制可用模型与 API Key 来源。

---

## 仓库结构

```
translator/
├── apps/
│   ├── extension/          # 浏览器扩展前端：Vite + React 19 + Ant Design + @crxjs/vite-plugin
│   │   ├── src/
│   │   │   ├── background/         # Service Worker（消息中枢、SSE 转发、鉴权刷新）
│   │   │   ├── content/            # 内容脚本：整页翻译 + 划词翻译（纯 TS）
│   │   │   ├── popup/              # 工具栏弹窗（React + Antd）
│   │   │   ├── options/            # 选项页（账户 / 模型 / 行为偏好）
│   │   │   ├── shared/             # API 客户端 / 存储封装 / Zustand store / 主题
│   │   │   └── manifest.ts         # 由 @crxjs/vite-plugin 处理的 MV3 清单
│   │   └── dist/                   # 构建产物，直接“加载已解压扩展”
│   └── server/             # NestJS 11 后端：鉴权、LLM 网关、SSE 翻译、配额计费
│       ├── prisma/                 # Prisma schema + 迁移
│       └── src/
│           ├── modules/
│           │   ├── auth/           # 邮箱密码 + JWT + OAuth/SMS 骨架
│           │   ├── user/           # 用户与会员等级
│           │   ├── billing/        # 订阅升级骨架（暂不接支付）
│           │   ├── quota/          # 使用量与配额
│           │   ├── llm/            # LLM Provider 注册、模型目录、Key 解析
│           │   ├── translation/    # 批翻译 / SSE 流式 / 划词翻译
│           │   └── health/
│           ├── common/             # 全局守卫 / 拦截器 / 装饰器
│           └── config/             # zod 校验后的类型化配置
├── packages/
│   ├── shared-types/       # 前后端共享 TS 类型（DTO / 会员 / 模型描述等）
│   ├── llm-core/           # LlmProvider 接口、ChatMessage 等核心抽象
│   ├── eslint-config/      # base / react / node 三套 ESLint 预设
│   └── tsconfig/           # base / react / node 三套 tsconfig 预设
├── docs/
│   ├── 需求功能文档.md      # 业务需求与验收标准
│   └── 技术实现文档.md      # 架构、目录、数据流、后续路线
├── turbo.json
├── pnpm-workspace.yaml
└── package.json            # 根脚本（turbo 调度）
```

---

## 技术栈

| 层级       | 选型                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| 前端       | React 19、Ant Design 6（原生兼容 React 19）、Zustand、@tanstack/react-query、Vite、@crxjs/vite-plugin |
| 浏览器扩展 | Chrome Manifest V3（service worker + content scripts + popup/options）                                |
| 后端       | NestJS 11、Prisma、PostgreSQL、JWT（refresh rotation）、Passport、Swagger、helmet、zod                |
| 流式协议   | SSE（fetch + ReadableStream，前端兼容扩展环境）                                                       |
| LLM 接入   | DeepSeek / OpenAI / Anthropic / Ollama / Google Translate（公开端点） / LibreTranslate                |
| 工程化     | pnpm workspace、turborepo、ESLint、Prettier、TypeScript、Husky、Commitlint（Angular）                 |

---

## 会员体系与 LLM Key 策略

| 等级 | 可用引擎                           | API Key 来源         |
| ---- | ---------------------------------- | -------------------- |
| 免费 | Google 公开端点 / LibreTranslate   | 无需 Key             |
| 初级 | 通用 LLM（DeepSeek / OpenAI 等）   | 用户自带，保存在本地 |
| 高级 | 全部模型（含开发者赞助的高级模型） | 后端持有（env）      |

模型清单与 tier 可见性在 `apps/server/src/modules/llm/catalog/model.catalog.ts` 统一声明，前端通过 `/api/v1/llm/models` 拉取并按 `tier` 过滤展示。

---

## 快速开始

### 0. 环境要求

- Node.js ≥ 20.11
- pnpm ≥ 9
- （可选）PostgreSQL —— 后端默认连接本地数据库，可用仓库内 `apps/server/docker-compose.yml` 一键启动

### 1. 安装依赖

```bash
pnpm install
```

### 2. 复制环境变量

```bash
cp apps/server/.env.example apps/server/.env
cp apps/extension/.env.example apps/extension/.env
```

按需填入：

- `DATABASE_URL`
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
- 各 LLM Provider 的 API Key（仅高级会员模型必需）
- `VITE_API_BASE_URL`（默认 `http://localhost:3001`）

### 3. 启动开发环境

```bash
# 并行启动扩展和后端
pnpm dev

# 或单独启动
pnpm dev:web      # 仅扩展
pnpm dev:server   # 仅后端
```

### 4. 加载浏览器扩展

```bash
pnpm build:web
```

打开 `chrome://extensions` → 开启开发者模式 → 加载已解压扩展 → 选择 `apps/extension/dist`。

---

## 常用根脚本

| 命令                | 说明                                   |
| ------------------- | -------------------------------------- |
| `pnpm dev`          | turbo 并行启动所有子项目 dev           |
| `pnpm build`        | 构建所有子项目（缓存命中跳过）         |
| `pnpm lint`         | 全仓 ESLint                            |
| `pnpm lint:fix`     | 全仓 ESLint --fix                      |
| `pnpm format`       | Prettier 全仓格式化                    |
| `pnpm format:check` | Prettier 校验                          |
| `pnpm typecheck`    | 全仓 TypeScript 检查                   |
| `pnpm clean`        | 清理 dist/build/.turbo 与 node_modules |

各子项目内同样提供 `dev` / `build` / `lint` / `typecheck`，turbo 通过 workspace 过滤器精准调度。

---

## 提交规范

仓库使用 [Angular Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/) 风格，由 `commitlint` + `husky` 校验：

```
<type>(<scope>): <subject>

# 可选 body / footer，重大变更使用 BREAKING CHANGE:
```

常见 `type`: `feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`。

---

## 产品文档

- [docs/需求功能文档.md](docs/需求功能文档.md) — 业务需求、用户场景、验收标准
- [docs/技术实现文档.md](docs/技术实现文档.md) — 架构、目录、数据流、后续路线

---

## 许可证

MIT
