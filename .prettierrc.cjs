/** @type {import("prettier").Config} */
module.exports = {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  singleQuote: true,
  semi: true,
  trailingComma: 'all',
  bracketSpacing: true,
  arrowParens: 'always',
  endOfLine: 'auto',
  overrides: [
    {
      files: '*.md',
      options: { proseWrap: 'preserve' },
    },
    {
      files: '*.prisma',
      options: { plugins: [] },
    },
  ],
};
