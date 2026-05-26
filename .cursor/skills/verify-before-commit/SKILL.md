---
name: verify-before-commit
description: 在创建 git commit 之前对当前改动做完整的本地验证（typecheck + lint + build + format）。当用户要求「提交」「commit」「PR 之前检查一下」时使用，确保提交不会被 CI 或 pre-commit hook 阻断。
---

# 提交前验证流程

## 何时使用

- 用户说「commit 一下」「帮我提交」
- 用户说「准备发 PR」「跑下检查」
- 任何在 `git commit` 之前的最后阶段

## 标准三步

### Step 1：缩小范围跑必要的检查

按改动范围选择最小有效集，**不要**总是跑全量：

| 改动范围                  | 跑这些                                                        |
| ------------------------- | ------------------------------------------------------------- |
| 仅 `apps/extension`       | `pnpm --filter @translator/extension typecheck lint build`    |
| 仅 `apps/server`          | `pnpm --filter @translator/server typecheck lint build`       |
| 仅 `packages/*`           | `pnpm --filter @translator/<pkg> typecheck lint`              |
| 跨多个子项目 / 改了共享包 | `pnpm typecheck && pnpm lint && pnpm build`（turbo 自动并行） |
| 仅文档                    | `pnpm format:check`                                           |

### Step 2：格式校验

```bash
pnpm format:check
```

如果失败，跑：

```bash
pnpm format
```

### Step 3：实际 commit

走标准提交流程（见 `.cursor/rules/commit-style.mdc`）。`pre-commit` 钩子会自动再跑一次 lint-staged，所以前面校验通过这里几乎不会失败。

## 失败时的处理

| 失败类型                         | 行动                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| typecheck 报错                   | 必须修复，不允许 `// @ts-ignore` 绕过                                               |
| eslint error                     | 修复；warning 可暂留但需在 PR 说明                                                  |
| build 失败                       | 必修复                                                                              |
| 改了 `schema.prisma` 未 generate | 跑 `pnpm --filter @translator/server prisma:generate` 并提交 `src/generated/prisma` |
| commitlint 拒绝消息              | 重写消息，参照 `.cursor/rules/commit-style.mdc`                                     |

## 反模式

- ❌ 跳过本步直接 `git commit`（pre-commit 会拦但浪费时间）
- ❌ 用 `git commit --no-verify` 绕过 hook
- ❌ 把 `pnpm build` 失败当成 CI 的问题留给后续处理
