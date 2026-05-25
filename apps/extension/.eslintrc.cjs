module.exports = {
  root: true,
  extends: ['@translator/eslint-config/react'],
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: ['dist', 'node_modules', '*.cjs'],
};
