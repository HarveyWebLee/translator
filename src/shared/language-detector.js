/**
 * 启发式判断页面主体是否为英文。
 * 综合 html[lang]、meta、可见文本的字母/汉字比例。
 */

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "IFRAME",
  "SVG",
  "CODE",
  "PRE",
  "TEXTAREA",
  "INPUT",
  "SELECT",
  "OPTION",
]);

/**
 * 从 DOM 收集可见文本样本（最多 maxLen 字符）
 * @param {Document} doc
 * @param {number} maxLen
 * @returns {string}
 */
export function collectVisibleText(doc, maxLen = 8000) {
  const parts = [];
  let total = 0;

  const walker = doc.createTreeWalker(doc.body || doc.documentElement, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      const style = doc.defaultView?.getComputedStyle(parent);
      if (style && (style.display === "none" || style.visibility === "hidden")) {
        return NodeFilter.FILTER_REJECT;
      }
      const t = node.textContent?.trim();
      if (!t) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  while (walker.nextNode() && total < maxLen) {
    const t = walker.currentNode.textContent.trim();
    if (t.length < 2) continue;
    parts.push(t);
    total += t.length;
  }

  return parts.join(" ").slice(0, maxLen);
}

/**
 * 统计文本中各类字符占比
 * @param {string} text
 */
export function analyzeScriptRatios(text) {
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
    latin,
    cjk,
    latinRatio: total ? latin / total : 0,
    cjkRatio: total ? cjk / total : 0,
  };
}

/**
 * 读取页面声明的语言（html lang / meta）
 * @param {Document} doc
 * @returns {string|null} 如 "en", "en-US"
 */
export function getDeclaredLanguage(doc) {
  const htmlLang = doc.documentElement.getAttribute("lang")?.trim().toLowerCase();
  if (htmlLang) return htmlLang;

  const metaLang = doc.querySelector('meta[http-equiv="content-language"]')?.getAttribute("content");
  if (metaLang) return metaLang.trim().toLowerCase();

  const ogLocale = doc.querySelector('meta[property="og:locale"]')?.getAttribute("content");
  if (ogLocale) return ogLocale.trim().toLowerCase();

  return null;
}

/**
 * 判断是否为英文网站
 * @param {Document} doc
 * @param {{ latinRatio?: number, cjkRatio?: number }} thresholds
 * @returns {{ isEnglish: boolean, confidence: number, reason: string, sample: string }}
 */
export function detectEnglishPage(doc, thresholds = {}) {
  const latinThreshold = thresholds.latinRatio ?? 0.55;
  const cjkBlock = thresholds.cjkRatio ?? 0.12;

  const declared = getDeclaredLanguage(doc);
  if (declared) {
    if (declared.startsWith("zh") || declared.startsWith("ja") || declared.startsWith("ko")) {
      return { isEnglish: false, confidence: 0.9, reason: `声明语言: ${declared}`, sample: "" };
    }
    if (declared.startsWith("en")) {
      return { isEnglish: true, confidence: 0.85, reason: `声明语言: ${declared}`, sample: "" };
    }
  }

  const sample = collectVisibleText(doc);
  if (sample.length < 80) {
    return { isEnglish: false, confidence: 0.3, reason: "正文过少，无法判断", sample };
  }

  const { latinRatio, cjkRatio, total } = analyzeScriptRatios(sample);
  if (total < 40) {
    return { isEnglish: false, confidence: 0.3, reason: "有效字符过少", sample: sample.slice(0, 200) };
  }

  if (cjkRatio >= cjkBlock) {
    return {
      isEnglish: false,
      confidence: 0.8,
      reason: `中文占比 ${(cjkRatio * 100).toFixed(0)}%`,
      sample: sample.slice(0, 200),
    };
  }

  if (latinRatio >= latinThreshold) {
    return {
      isEnglish: true,
      confidence: Math.min(0.95, 0.5 + latinRatio),
      reason: `拉丁字母占比 ${(latinRatio * 100).toFixed(0)}%`,
      sample: sample.slice(0, 200),
    };
  }

  return {
    isEnglish: false,
    confidence: 0.5,
    reason: `拉丁字母占比 ${(latinRatio * 100).toFixed(0)}% 不足`,
    sample: sample.slice(0, 200),
  };
}
