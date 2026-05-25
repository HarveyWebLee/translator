/**
 * Node.js / NestJS ESLint 预设。
 */
module.exports = {
  extends: ['./base.cjs'],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-extraneous-class': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-floating-promises': 'off',
  },
};
