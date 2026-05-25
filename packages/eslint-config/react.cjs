/**
 * React 19 + 浏览器扩展 ESLint 预设。
 */
module.exports = {
  extends: [
    './base.cjs',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  plugins: ['react-refresh'],
  settings: {
    react: { version: '19.0' },
  },
  env: {
    browser: true,
    es2022: true,
    webextensions: true,
  },
  globals: {
    chrome: 'readonly',
    browser: 'readonly',
  },
  rules: {
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'jsx-a11y/click-events-have-key-events': 'off',
    'jsx-a11y/no-static-element-interactions': 'off',
  },
};
