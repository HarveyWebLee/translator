# AGENTS.md — 代理工作指南

> 本文档为 AI 代理（Cursor / Copilot / Claude / Cody 等）在本仓库工作时的总览手册。
> 项目级细则见 [`.cursor/rules/`](.cursor/rules)，可复用操作流程见 [`.cursor/skills/`](.cursor/skills)。

---

## 1. 项目快照

| 项   | 值                                                                        |
| ---- | ------------------------------------------------------------------------- |
| 项目 | AI 翻译助手（浏览器扩展 + 公共云端后端）                                  |
| 形态 | Monorepo（pnpm@9 + turborepo）                                            |
| 前端 | Vite + React 19 + Ant Design 6 + Zustand + @tanstack/react-query          |
| 扩展 | Chrome Manifest V3，`@crxjs/vite-plugin` 多入口                           |
| 后端 | NestJS 11 + PostgreSQL + Prisma + JWT + SSE                               |
| LLM  | DeepSeek / OpenAI / Anthropic / Ollama / Google 公开端点 / LibreTranslate |
| 会员 | free / basic / premium 三档，绑定可用模型与 API Key 来源                  |
| Node | ≥ 20.11                                                                   |
| pnpm | ≥ 9                                                                       |

---

## 2. 必读清单

收到任务时，根据范围按需读取（**不要全部一次读完，按需加载**）：

| 改动范围             | 必读                                                                          |
| -------------------- | ----------------------------------------------------------------------------- |
| 任何任务             | `.cursor/rules/monorepo-conventions.mdc`、`.cursor/rules/commit-style.mdc`    |
| 后端                 | `.cursor/rules/nestjs-server.mdc`                                             |
| 前端 React/Antd 入口 | `.cursor/rules/react-extension.mdc`                                           |
| 内容脚本             | `.cursor/rules/content-script.mdc`                                            |
| LLM 接入             | `.cursor/rules/llm-provider.mdc` + `.cursor/skills/add-llm-provider/SKILL.md` |
| 新增共享类型         | `.cursor/skills/add-shared-type/SKILL.md`                                     |
| 提交前               | `.cursor/skills/verify-before-commit/SKILL.md`                                |
| 业务需求             | `docs/需求功能文档.md`                                                        |
| 技术架构             | `docs/技术实现文档.md`                                                        |

---

## 3. 仓库地图

```
.
├── apps/
│   ├── extension/                 浏览器扩展前端
│   │   ├── src/
│   │   │   ├── background/        Service Worker（消息中枢 + SSE 转发）
│   │   │   ├── content/           内容脚本（vanilla TS，禁止 React）
│   │   │   ├── popup/             工具栏弹窗（React + Antd）
│   │   │   ├── options/           选项页：账户 / 模型 / 行为
│   │   │   ├── shared/            api / storage / store / styles / utils
│   │   │   └── manifest.ts        MV3 清单（TS 形式，crxjs 处理）
│   │   └── dist/                  构建产物（直接「加载已解压扩展」）
│   └── server/                    NestJS 后端
│       ├── prisma/                schema + 迁移
│       └── src/
│           ├── common/            守卫 / 拦截器 / 装饰器 / 过滤器
│           ├── config/            zod 校验 + 类型化 AppConfigService
│           └── modules/           auth / user / llm / translation / quota / billing / health / prisma
├── packages/
│   ├── shared-types/              前后端共享 TS 类型
│   ├── llm-core/                  LlmProvider 抽象
│   ├── eslint-config/             base / react / node 三套预设
│   └── tsconfig/                  base / react / node 三套预设
├── docs/                          产品 / 技术 / 启动 / 部署文档
├── .cursor/                       Cursor 规则 / skills / hooks
├── .husky/                        commit-msg + pre-commit 钩子
└── turbo.json / pnpm-workspace.yaml
```

---

## 4. 常用命令

```bash
# 安装
pnpm install

# 开发（turbo 并行）
pnpm dev               # 前后端一起起
pnpm dev:web           # 仅扩展
pnpm dev:server        # 仅后端

# 构建
pnpm build
pnpm build:web         # 产物 → apps/extension/dist
pnpm build:server      # 产物 → apps/server/dist

# 质量
pnpm typecheck         # 全仓 TS
pnpm lint              # 全仓 ESLint
pnpm lint:fix
pnpm format            # Prettier 全仓
pnpm format:check
```

子项目内同名脚本一致，可用 `pnpm --filter @translator/<pkg> <task>` 精准调度。

---

## 5. 代理工作守则

### 5.1 必须遵守

1. **回复使用简体中文**（用户偏好）。
2. **跨包引用使用 workspace 别名**（`@translator/*`），禁止相对路径跨包。
3. **共享类型放 `packages/shared-types`**，禁止在 apps 内重复声明。
4. **提交信息走 Angular Conventional Commits + 中文**，scope 与 type 见 `.cursor/rules/commit-style.mdc`。
5. **提交前**走 `verify-before-commit` skill 校验，不允许 `--no-verify`。
6. **代码注释**：详细说明非显而易见的设计意图、约束、权衡；禁止「// 引入模块」之类的废话。
7. **不主动创建总结/进度文档**，除非用户明确要求。

### 5.2 谨慎操作

下列命令会被 `.cursor/hooks/guard-shell.sh` 拦截要求二次确认：

- `rm -rf ...`
- `git push --force ...`
- `pnpm publish` / `npm publish`
- `DROP TABLE` / `TRUNCATE TABLE`

需要 force push 等操作时，向用户明确说明并征得同意。

### 5.3 文件编辑

- 编辑后会触发 `.cursor/hooks/format-after-edit.sh`，自动 `prettier --write`，无需手动格式化
- 与 husky pre-commit 双重保险，提交时再次校验

---

## 6. 关键架构约束（避免踩坑）

### 6.1 LLM 接入

- 三维矩阵：`tier`（free/basic/premium）× `keySource`（none/user/system）× `capabilities`
- 错配会导致 `MembershipGuard` 误放行或 `LlmService.resolveKey` 抛错
- 新增 provider 必走 `add-llm-provider` skill

### 6.2 SSE in Chrome Extension

- 扩展中 `EventSource` **无法**携带自定义请求头（如 `Authorization`）
- 项目使用 `fetch + ReadableStream` 在 service-worker 消费，再 `chrome.tabs.sendMessage` 转发给 content
- 不要试图把 `EventSource` 用在 popup/options 直接调后端

### 6.3 Content Script 隔离

- 运行在独立 JS 上下文，无法直接访问页面 `window.xxx`
- React 不应在此引入（体积 + 第三方页冲突）
- CSS 通过 `import './foo.css'` 由 vite + crxjs 自动注入到 manifest，不要在 manifest.ts 手填 `css:[]`

### 6.4 API Key 分层

| 来源     | 存储位置                              | 安全等级                     |
| -------- | ------------------------------------- | ---------------------------- |
| 高级模型 | 后端 `.env`（仅高级会员可触发）       | 最高，不上送前端             |
| 通用 LLM | 前端 `chrome.storage.local`（不同步） | 用户自管，请求时随 body 上送 |
| 免费引擎 | 无                                    | -                            |

禁止把用户 Key 写入 `chrome.storage.sync`（会跨设备明文同步）。

---

## 7. 相关文档

- [README.md](README.md)
- [docs/需求功能文档.md](docs/需求功能文档.md)
- [docs/技术实现文档.md](docs/技术实现文档.md)
- [docs/生产环境启动文档.md](docs/生产环境启动文档.md)
- [docs/部署文档.md](docs/部署文档.md)
