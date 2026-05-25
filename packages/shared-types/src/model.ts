import type { MembershipTier } from './membership';

/**
 * API Key 来源策略
 * - system：后端持有（开发者付费），仅 premium 可用
 * - user：前端用户自带（保存在 chrome.storage.local），basic 可用
 * - none：无需 Key（免费引擎）
 */
export type KeySource = 'system' | 'user' | 'none';

export type ModelCapability = 'chat' | 'json' | 'stream' | 'translate' | 'dict';

export interface ModelDescriptor {
  /** 模型唯一 id，如 'deepseek-chat' */
  id: string;
  /** 展示名称 */
  label: string;
  /** 所属 Provider id，如 'deepseek' / 'openai' / 'google-free' */
  providerId: string;
  /** 能力位 */
  capabilities: ModelCapability[];
  /** 上下文长度 */
  contextWindow: number;
  /** 最低会员等级要求 */
  minTier: MembershipTier;
  /** 该等级下的 Key 来源 */
  keySource: KeySource;
  /** 计费/性能等提示文案 */
  priceHint?: string;
  /** 默认温度 */
  defaultTemperature?: number;
}

export interface ProviderDescriptor {
  id: string;
  label: string;
  /** 鉴权模式（向前端说明配置形式） */
  authMode: 'api-key' | 'none' | 'oauth';
  models: ModelDescriptor[];
}
