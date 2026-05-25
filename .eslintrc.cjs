/**
 * 根 ESLint 基线：仅声明全局忽略与基础规则，子项目继承 @translator/eslint-config 的具体预设。
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  ignorePatterns: ['dist', 'build', 'node_modules', '.turbo', 'coverage', '*.cjs'],
  extends: ['@translator/eslint-config/base'],
};
