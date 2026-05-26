---
name: add-shared-type
description: 在 packages/shared-types 中新增前后端共享的 TypeScript 类型、DTO 或枚举。当用户要求「加一个共享类型」「前后端要传 XX 数据结构」「新增一个 DTO」时使用，避免在 apps/server 与 apps/extension 内重复声明导致漂移。
---

# 新增共享类型

## 何时使用

- 后端新增 API，前端要消费其响应/请求体
- 前后端枚举（如新增 `MembershipTier` 档位）
- 跨包共享的工具函数签名

## 文件分组

`packages/shared-types/src/` 内按主题拆文件：

| 文件             | 内容                                                  |
| ---------------- | ----------------------------------------------------- |
| `auth.ts`        | 登录注册 DTO、`UserProfile`、`OAuthProvider`、SMS DTO |
| `membership.ts`  | `MembershipTier`、`isTierAtLeast`                     |
| `model.ts`       | `ModelDescriptor`、`ProviderDescriptor`、`KeySource`  |
| `translation.ts` | 翻译相关 DTO 与 `TranslateStreamEvent`                |
| `common.ts`      | `ApiResponse<T>`、`Paginated<T>` 等通用结构           |
| `<new-topic>.ts` | 新主题独立成文件，避免单文件过大                      |

## 步骤

### 1. 写类型

```ts
// packages/shared-types/src/billing.ts
export type SubscriptionStatus = 'pending' | 'active' | 'expired' | 'canceled';

export interface SubscriptionDto {
  id: string;
  tier: 'basic' | 'premium';
  status: SubscriptionStatus;
  startsAt: string; // ISO-8601
  expiresAt: string;
}
```

### 2. 在 `index.ts` re-export

```ts
// packages/shared-types/src/index.ts
export * from './billing';
```

### 3. 前后端按 workspace 别名导入

```ts
// apps/server / apps/extension
import type { SubscriptionDto } from '@translator/shared-types';
```

### 4. 校验

```bash
pnpm --filter @translator/shared-types typecheck lint
# 然后任意一个依赖方
pnpm --filter @translator/server typecheck
pnpm --filter @translator/extension typecheck
```

## 反模式

- ❌ 在 `apps/server/src/dto/` 与 `apps/extension/src/types/` 重复定义同一个 interface
- ❌ 共享类型里依赖运行时库（如 NestJS / antd / prisma） —— 仅放纯 TS 类型与工具函数
- ❌ 使用 `enum`，应使用 `as const` + 联合类型，方便树摇与编译产物体积

```ts
// ✅ GOOD
export const MEMBERSHIP_TIERS = ['free', 'basic', 'premium'] as const;
export type MembershipTier = (typeof MEMBERSHIP_TIERS)[number];

// ❌ BAD
export enum MembershipTier {
  Free,
  Basic,
  Premium,
}
```
