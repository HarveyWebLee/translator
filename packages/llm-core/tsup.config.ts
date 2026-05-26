import { defineConfig } from 'tsup';

/**
 * llm-core 同样是前后端共享的接口抽象包：
 *   - 后端（NestJS / CJS）通过 require 解析 ./dist/index.cjs
 *   - 前端如有需要可通过 ESM 解析 ./dist/index.js
 *
 * external 声明：@translator/shared-types 也是 workspace 包，
 * 由消费方各自解析对应产物，不要把它一起内联到本包的 bundle 里，
 * 否则会出现「同一份类型来自两份不同 dist」的对象身份冲突。
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
  external: ['@translator/shared-types'],
});
