import { defineConfig } from 'tsup';

/**
 * shared-types 是前后端共享的纯类型/常量包。
 * 这里需要同时产出 ESM 与 CJS：
 *   - extension（Vite，ESM 解析）走 ./dist/index.js
 *   - server（NestJS 编译为 CommonJS，require 解析）走 ./dist/index.cjs
 *   - 同时产出 .d.ts 供 IDE 与 tsc 推断类型
 *
 * splitting 关闭、treeshake 打开：本包对外提供少量稳定的类型/常量，
 * 不需要 chunk 拆分；treeshake 可帮助消费方在 bundle 中剔除未引用的常量。
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  target: 'es2022',
  outDir: 'dist',
});
