/** 不翻译这些容器及其子树（pre/code 内 hljs 嵌套 span 也会被跳过） */
export const SKIP_SELECTOR =
  'script,style,noscript,iframe,svg,code,pre,textarea,input,select,option';

export function isInsideSkipContainer(node: Node): boolean {
  const parent = (node as Text).parentElement;
  return !!(parent && parent.closest(SKIP_SELECTOR));
}
