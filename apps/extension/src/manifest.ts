import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'AI 翻译助手（DeepSeek/OpenAI/Anthropic）',
  version: '2.0.0',
  description:
    '识别英文网页并通过 LLM 或免费引擎翻译为简体中文；支持划词翻译、SSE 流式翻译与会员体系。',
  icons: {
    16: 'icons/icon16.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'icons/icon16.png',
      48: 'icons/icon48.png',
    },
    default_title: 'AI 翻译助手',
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  permissions: ['storage', 'activeTab', 'scripting'],
  host_permissions: ['http://localhost:3001/*', 'https://*/*', 'http://*/*'],
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      // CSS 通过各自的 content script 内部 `import` 引入，由 vite + crxjs 自动注入到 manifest。
      js: ['src/content/content.ts', 'src/content/selection-translate.ts'],
      run_at: 'document_idle',
      all_frames: false,
    },
  ],
  web_accessible_resources: [
    {
      resources: ['icons/*'],
      matches: ['<all_urls>'],
    },
  ],
});
