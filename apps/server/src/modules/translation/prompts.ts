/**
 * 翻译 Prompt 模板。沿用旧扩展中的策略：
 * - 批量：JSON 数组进、JSON 数组出，长度一致
 * - 划词：词典式 JSON 对象
 */

export const SYSTEM_PROMPT_SINGLE = `你是一名专业翻译。将用户提供的英文内容准确翻译为简体中文。
要求：
1. 只输出译文，不要解释、不要加引号或前后缀。
2. 保留原文中的换行、列表符号与基本格式。
3. 专有名词可保留英文或采用通用译法。
4. 若原文已是中文或无法翻译，原样返回。`;

export const SYSTEM_PROMPT_BATCH = `你是一名专业翻译。用户会提供一个 JSON 数组，每个元素是一段待翻译的英文。
你必须只输出一个 JSON 数组：
- 数组长度必须与输入完全相同
- 每个元素是对应位置的中文译文（字符串）
- 不要输出 markdown 代码块标记、解释文字或任何分隔符
- 仅输出可被 JSON.parse 解析的纯 JSON 数组`;

export const SYSTEM_PROMPT_SELECTION = `你是专业的英汉词典与翻译助手。用户划选了网页上的英文，并提供了页面上下文。
请只输出一个 JSON 对象（不要 markdown），字段如下：
{
  "term": "划选的原文",
  "phonetic": "IPA 国际音标，单词时必填，短语/句子可留空字符串",
  "partOfSpeech": "词性缩写，如 n. / v. / adj. / phrase；句子填 sentence",
  "briefDefinition": "简短中文释义，一行",
  "exampleEn": "包含该词的英文例句",
  "exampleZh": "例句的中文翻译",
  "contextExplanation": "结合所给网页上下文，用 2-4 句中文解释该词/句在此处的含义"
}`;

/** 清除模型可能误输出的内部分隔符与多余空白 */
export function sanitizeTranslation(text: string): string {
  if (!text) return '';
  return text
    .replace(/<<<SEG>>>/gi, '')
    .replace(/&lt;&lt;&lt;SEG&gt;&gt;&gt;/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 解析模型返回的 JSON 数组（容忍 ```json 围栏） */
export function parseJsonArray(raw: string, expectedLen: number): string[] | null {
  let s = raw.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fence) s = fence[1]!.trim();
  const arrMatch = s.match(/\[[\s\S]*\]/);
  if (arrMatch) s = arrMatch[0];

  try {
    const parsed: unknown = JSON.parse(s);
    if (!Array.isArray(parsed)) return null;
    const items = parsed.map((x) => sanitizeTranslation(String(x ?? '')));
    if (items.length === expectedLen) return items;
    if (items.length > 0) {
      const result = items.slice(0, expectedLen);
      while (result.length < expectedLen) result.push('');
      return result;
    }
  } catch {
    /* fallthrough */
  }
  return null;
}
