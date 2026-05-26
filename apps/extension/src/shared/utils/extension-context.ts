/**
 * 判断当前页面是否运行在已加载的 Chrome 扩展上下文中。
 * 在 Vite dev server 的普通浏览器标签（localhost:9696）里 chrome.storage / chrome.tabs 不可用。
 */
export function isChromeExtensionContext(): boolean {
  return typeof chrome !== 'undefined' && typeof chrome.runtime?.id === 'string';
}

/** dev server 下打开 options 页；扩展内走 chrome.runtime.openOptionsPage */
export function openOptionsPage(): void {
  if (isChromeExtensionContext() && chrome.runtime.openOptionsPage) {
    void chrome.runtime.openOptionsPage();
    return;
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:9696';
  window.open(`${origin}/src/options/index.html`, '_blank');
}
