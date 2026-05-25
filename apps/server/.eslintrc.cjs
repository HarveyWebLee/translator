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
  ignorePatterns: ['dist', 'node_modules', 'prisma/migrations'],
};
