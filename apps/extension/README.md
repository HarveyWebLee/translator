# @translator/extension

Chrome / Edge 浏览器扩展（Manifest V3）。

## 技术栈

- React 19 + Antd 6（原生兼容 React 19）
- Vite 5 + `@crxjs/vite-plugin`
- 多入口：`popup` / `options`（React），`content` / `selection-translate` / `service-worker`（原生 TS）

## 本地开发

```bash
# 复制环境变量并按需调整后端地址
cp .env.example .env.local

pnpm dev          # 启动 Vite 与 watch 模式
# 浏览器加载未打包扩展：选择 apps/extension/dist 目录
```

## 本地开发与热更新行为

`pnpm dev` 内部跑的是 `vite`（非 `vite build --watch`），叠加 `@crxjs/vite-plugin` 后变成**混合模式**：

- **HTML 入口（popup / options）**：由 Vite dev server 走内存提供，`dist/` 里只放指向 `http://localhost:9696/...` 的占位壳；真正的页面与 HMR WebSocket 经 9697 端口推送。
- **Service Worker、Content Script、CSS、静态资源**：MV3 强制要求 manifest 字段指向真实文件，crxjs 会**实时编译并写入 `dist/`**，文件改了立刻同步。

也就是说：**改前端代码后 `dist/` 一定会同步变**，但"热"的程度因入口而异。

### 各入口热更新对照

| 改动位置                                     | `dist/` 同步                           | 浏览器侧需要的操作                                                         |
| -------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------- |
| `src/popup/**`                               | 自动                                   | popup 关闭再开即生效；保持打开则真 HMR                                     |
| `src/options/**`                             | 自动                                   | options 页保持打开，真 HMR 实时刷新                                        |
| `src/content/**`                             | 自动                                   | crxjs 自动刷新匹配的网页标签页                                             |
| `src/background/service-worker.ts`           | 自动                                   | **必须**去 `chrome://extensions/` 点扩展卡片上的「🔄 重新加载」            |
| `src/manifest.ts`（权限 / 匹配规则 / 入口）  | 自动（全量重写 manifest.json）         | **必须**手动重载扩展；新增 host_permissions 时有时需重新「加载已解压扩展」 |
| `src/shared/**` 公共模块                     | 自动                                   | 看消费方：popup/options 走 HMR；background 需重载扩展                      |
| `packages/shared-types`、`packages/llm-core` | 自动（tsup `--watch` → vite 二次重建） | 同上，链路稍长，一般 1–3 秒                                                |

### 常见坑位

1. **改完 Service Worker 不重载扩展，跑的还是旧 worker**。crxjs 不会自动重启 SW，调试 background 时务必养成"改完去 `chrome://extensions/` 点刷新"的肌肉记忆。
2. **popup 关闭后即销毁**，再次点开等同新建实例，所以多数情况下你感受不到 HMR——直接重开 popup 已经是最新代码。想体验真 HMR，可在 popup 上右键「检查」把它拉成独立 DevTools 窗口保持运行。
3. **HMR WebSocket 端口 9697 被占用会静默失败**（见 `vite.config.ts` 中的 `hmr.port`）。表现是"文件变了但页面不刷新"，而 `dist/` 其实已经更新。排查：

   ```bash
   # Windows
   netstat -ano | findstr 9697
   # macOS / Linux
   lsof -i :9697
   ```

4. **content script 的 CSS 改动不是真 CSS HMR**，而是触发当前页 reload；按 `manifest.ts` 注释 CSS 经 content script 内 `import './foo.css'` 引入，由 crxjs 自动注入 manifest。
5. **`manifest.ts` 改动是全量重建**，新增 host_permissions / 权限 / 入口时 Chrome 不会自动接受 manifest 变更，必须手动重载扩展。
6. **避免使用 `vite build --watch` 替代 dev**：产物是完全独立的 `dist/`，但会丢掉 popup/options 的 HMR，每次都得重开 popup。仅在打包前自测、或临时调试构建产物时使用。

### 推荐开发动作流

1. `pnpm dev`（或仓库根目录 `pnpm dev:web`，仅启动扩展相关 workspace）保持运行。
2. Chrome 一次性「加载已解压扩展」→ 选 `apps/extension/dist`。
3. 改 popup / options / content：直接看效果（必要时刷新页面 / 重开 popup）。
4. 改 service-worker / manifest：去 `chrome://extensions/` 点扩展卡片的 🔄。
5. 把 `chrome://extensions/` 标签常驻一个；调试 background 时点卡片里的「Service Worker」即可进入 DevTools，重载后直接看新日志。

## 构建

```bash
pnpm build
# 产物：apps/extension/dist
```

## 目录结构

```
src/
├── manifest.ts                  TS 定义 MV3，crx 插件构建时生成 manifest.json
├── background/                  Service Worker（无 React）
├── content/                     内容脚本（无 React，原生 DOM）
├── popup/                       浏览器图标弹出页（React + Antd）
├── options/                     选项页：账户/模型/行为（React + Antd）
├── auth/                        登录/注册组件
├── shared/                      API 客户端、SSE、状态、工具
└── styles/
```

## 与后端联调

前端通过 `VITE_API_BASE_URL` 调用后端：

- `POST /auth/register` `/auth/login` `/auth/refresh`
- `GET /auth/me` `/user/membership`
- `GET /llm/models`
- `POST /translation/batch` `/translation/selection`
- `POST /translation/stream/session` → SSE `/translation/stream/:id?token=...`
