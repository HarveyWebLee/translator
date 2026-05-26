/**
 * 扩展仅能在普通网页上注入脚本（manifest content_scripts 也只匹配 http/https）。
 * chrome://、edge://、chrome-extension://、about: 等页面调用 scripting API 会抛错。
 */
export function isInjectableTabUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export function isInjectableTab(
  tab: chrome.tabs.Tab | undefined,
): tab is chrome.tabs.Tab & { id: number; url: string } {
  return Boolean(tab?.id && isInjectableTabUrl(tab.url));
}
