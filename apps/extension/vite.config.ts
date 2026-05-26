import { resolve } from 'node:path';

import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import manifest from './src/manifest';

export default defineConfig({
  // 生产包必须用相对路径：默认 base='/' 会在 popup/options HTML 里生成
  // src="/assets/..."，Chrome 扩展页解析会报 Invalid path（?errors= 页常见）
  base: './',
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    rollupOptions: {
      // crx 插件会自动配置入口，这里仅做兜底
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
      },
    },
  },
  server: {
    // 自定义本地开发端口：避开 Vite 默认 5173，与团队约定使用 9696
    port: 9696,
    strictPort: true,
    hmr: {
      // HMR WebSocket 走独立端口，避开主端口可能的占用冲突
      port: 9697,
    },
  },
});
