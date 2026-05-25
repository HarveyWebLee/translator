/**
 * Vite 注入的环境变量集中点。
 * 通过 `VITE_API_BASE_URL` 配置后端地址；运行时不可修改。
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
