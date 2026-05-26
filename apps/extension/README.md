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
