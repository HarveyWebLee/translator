module.exports = {
  root: true,
  extends: ['@translator/eslint-config/react'],
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  // 顶层 *.config.ts（vite/vitest/playwright 等配置文件）不进入 typed-lint：
  // 它们被 tsconfig.json 的 exclude 故意排除（避免 node 类型污染 src 上下文），
  // 一旦走 ESLint typed-lint 就会触发 "TSConfig does not include this file" 错误。
  // prettier 仍会通过 lint-staged 单独跑过它们，格式化不会缺失。
  ignorePatterns: ['dist', 'node_modules', '*.cjs', '*.config.ts'],
};
