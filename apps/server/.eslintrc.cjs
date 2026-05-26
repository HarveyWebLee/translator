module.exports = {
  root: true,
  extends: ['@translator/eslint-config/node'],
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
  },
  // 以下文件不在 tsconfig.json 的 include 内，勿走 type-aware lint（与 extension 的 *.cjs / *.config.ts 一致）
  ignorePatterns: [
    'dist',
    'node_modules',
    'prisma/migrations',
    'src/generated',
    '*.cjs',
    'prisma.config.ts',
    'prisma/seed.ts',
  ],
};
