/**
 * 启发式判断页面主体是否为英文。复用旧实现，对 pre/code 等容器祖先跳过。
 */
const SKIP_SELECTOR = 'script,style,noscript,iframe,svg,code,pre,textarea,input,select,option';

function isInsideSkipContainer(node: Node): boolean {
  const parent = (node as Text).parentElement;
  return !!(parent && parent.closest(SKIP_SELECTOR));
}

export function collectVisibleText(doc: Document, maxLen = 8000): string {
  const parts: string[] = [];
  let total = 0;
  const root = doc.body || doc.documentElement;
  if (!root) return '';

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (isInsideSkipContainer(node)) return NodeFilter.FILTER_REJECT;
      const parent = (node as Text).parentElement;
      if (parent) {
        try {
          const style = doc.defaultView?.getComputedStyle(parent);
          if (style && (style.display === 'none' || style.visibility === 'hidden')) {
            return NodeFilter.FILTER_REJECT;
          }
        } catch {
          /* ignore */
        }
      }
      const t = node.textContent?.trim();
      if (!t) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  while (walker.nextNode() && total < maxLen) {
    const t = walker.currentNode.textContent!.trim();
    if (t.length < 2) continue;
    parts.push(t);
    total += t.length;
  }
  return parts.join(' ').slice(0, maxLen);
}

export function analyzeScriptRatios(text: string): {
  total: number;
  latinRatio: number;
  cjkRatio: number;
} {
  let latin = 0;
  let cjk = 0;
  let total = 0;
  for (const ch of text) {
    if (/\s/.test(ch)) continue;
    total++;
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) cjk++;
    else if (/[a-zA-Z]/.test(ch)) latin++;
  }
  return {
    total,
    latinRatio: total ? latin / total : 0,
    cjkRatio: total ? cjk / total : 0,
  };
}

export function getDeclaredLanguage(doc: Document): string | null {
  const htmlLang = doc.documentElement.getAttribute('lang');
  if (htmlLang) return htmlLang.trim().toLowerCase();
  const meta = doc.querySelector('meta[http-equiv="content-language"]');
  if (meta) return (meta.getAttribute('content') ?? '').trim().toLowerCase();
  return null;
}

export interface DetectionResult {
  isEnglish: boolean;
  confidence: number;
  reason: string;
}

export function detectEnglishPage(doc: Document): DetectionResult {
  const declared = getDeclaredLanguage(doc);
  if (declared) {
    if (/^zh|^ja|^ko/.test(declared)) {
      return { isEnglish: false, confidence: 0.9, reason: `声明语言: ${declared}` };
    }
    if (/^en/.test(declared)) {
      return { isEnglish: true, confidence: 0.85, reason: `声明语言: ${declared}` };
    }
  }

  const sample = collectVisibleText(doc);
  if (sample.length < 80) {
    return { isEnglish: false, confidence: 0.3, reason: '正文过少' };
  }
  const r = analyzeScriptRatios(sample);
  if (r.total < 40) {
    return { isEnglish: false, confidence: 0.3, reason: '有效字符过少' };
  }
  if (r.cjkRatio >= 0.12) {
    return { isEnglish: false, confidence: 0.8, reason: '中文占比较高' };
  }
  if (r.latinRatio >= 0.55) {
    return {
      isEnglish: true,
      confidence: Math.min(0.95, 0.5 + r.latinRatio),
      reason: `拉丁字母占比 ${Math.round(r.latinRatio * 100)}%`,
    };
  }
  return { isEnglish: false, confidence: 0.5, reason: '未达英文阈值' };
}
