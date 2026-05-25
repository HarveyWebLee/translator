/**
 * DeepSeek Chat Completions 客户端（OpenAI 兼容）。
 * 在 Service Worker 中调用，避免内容脚本 CORS 限制。
 */

import { DEEPSEEK_API_URL, DEFAULT_MODEL } from "./constants.js";

const SYSTEM_PROMPT = `你是一名专业翻译。将用户提供的英文内容准确翻译为简体中文。
要求：
1. 只输出译文，不要解释、不要加引号或前后缀。
2. 保留原文中的换行、列表符号与基本格式。
3. 专有名词可保留英文或采用通用译法。
4. 若原文已是中文或无法翻译，原样返回。`;

/** 批量翻译专用：强制 JSON 数组输出，避免分隔符泄露到页面 */
const BATCH_SYSTEM_PROMPT = `你是一名专业翻译。用户会提供一个 JSON 数组，每个元素是一段待翻译的英文。
你必须只输出一个 JSON 数组：
- 数组长度必须与输入完全相同
- 每个元素是对应位置的中文译文（字符串）
- 不要输出 markdown 代码块标记、解释文字、<<<SEG>>> 或任何分隔符
- 仅输出可被 JSON.parse 解析的纯 JSON 数组`;

/**
 * 清除误写入译文的内部分隔符（历史版本遗留）
 * @param {string} text
 */
export function sanitizeTranslation(text) {
  if (!text || typeof text !== "string") return text || "";
  return text
    .replace(/<<<SEG>>>/gi, "")
    .replace(/&lt;&lt;&lt;SEG&gt;&gt;&gt;/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 调用 DeepSeek API
 */
async function chatCompletion({ apiKey, model, messages, temperature = 0.3 }) {
  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream: false,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errMsg =
      data?.error?.message || data?.message || `DeepSeek API 错误: HTTP ${response.status}`;
    throw new Error(errMsg);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("DeepSeek 返回格式异常");
  }

  return content.trim();
}

/**
 * 翻译单段文本
 */
export async function translateWithDeepSeek({ apiKey, model = DEFAULT_MODEL, text }) {
  if (!apiKey?.trim()) {
    throw new Error("请先在扩展选项中配置 DeepSeek API Key");
  }
  if (!text?.trim()) {
    return text || "";
  }

  const content = await chatCompletion({
    apiKey,
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `请将以下英文翻译为简体中文：\n\n${text}` },
    ],
  });

  return sanitizeTranslation(content);
}

/**
 * 从模型回复中解析 JSON 数组
 * @param {string} raw
 * @param {number} expectedLen
 * @returns {string[]|null}
 */
export function parseTranslationJsonArray(raw, expectedLen) {
  let s = raw.trim();

  // 去掉 ```json ... ``` 包裹
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fence) s = fence[1].trim();

  // 尝试截取首个 [ ... ] 数组
  const arrMatch = s.match(/\[[\s\S]*\]/);
  if (arrMatch) s = arrMatch[0];

  try {
    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed)) return null;

    const items = parsed.map((item) => sanitizeTranslation(String(item ?? "")));

    if (items.length === expectedLen) return items;

    // 长度不一致时：多则截断，少则用空串补齐（后续由调用方决定是否逐条重试）
    if (items.length > 0) {
      const result = items.slice(0, expectedLen);
      while (result.length < expectedLen) result.push("");
      return result;
    }
  } catch {
    /* 解析失败 */
  }

  return null;
}

/**
 * 批量翻译：JSON 数组模式；失败则逐条翻译，确保不泄露 SEG 标记
 * @param {{ apiKey: string, model?: string, batch: { index: number, text: string }[] }} opts
 * @returns {Promise<Map<number, string>>}
 */
export async function translateBatch({ apiKey, model = DEFAULT_MODEL, batch }) {
  const result = new Map();

  if (!batch.length) return result;

  // 单段直接翻译
  if (batch.length === 1) {
    const t = await translateWithDeepSeek({ apiKey, model, text: batch[0].text });
    result.set(batch[0].index, t);
    return result;
  }

  const inputTexts = batch.map((b) => b.text);
  const userPayload = JSON.stringify(inputTexts);

  let raw;
  try {
    raw = await chatCompletion({
      apiKey,
      model,
      messages: [
        { role: "system", content: BATCH_SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `以下 JSON 数组共 ${batch.length} 段英文，请按相同顺序返回 ${batch.length} 段中文，仅输出 JSON 数组：\n${userPayload}`,
        },
      ],
      temperature: 0.2,
    });
  } catch (e) {
    return translateBatchSequential({ apiKey, model, batch });
  }

  let parts = parseTranslationJsonArray(raw, batch.length);

  // JSON 不可靠或含空项过多时，对失败项逐条重译
  if (!parts) {
    return translateBatchSequential({ apiKey, model, batch });
  }

  const needRetry = [];
  batch.forEach((b, i) => {
    const zh = parts[i];
    if (zh && zh.length > 0 && !/<<<SEG>>>/i.test(zh)) {
      result.set(b.index, zh);
    } else {
      needRetry.push(b);
    }
  });

  if (needRetry.length > 0) {
    const retryMap = await translateBatchSequential({ apiKey, model, batch: needRetry });
    retryMap.forEach((v, k) => result.set(k, v));
  }

  // 确保每条都有结果
  batch.forEach((b) => {
    if (!result.has(b.index)) {
      result.set(b.index, sanitizeTranslation(b.text));
    }
  });

  return result;
}

/**
 * 逐条翻译（降级方案，API 调用次数多但结果准确）
 */
async function translateBatchSequential({ apiKey, model, batch }) {
  const result = new Map();
  for (const b of batch) {
    try {
      const t = await translateWithDeepSeek({ apiKey, model, text: b.text });
      result.set(b.index, t);
    } catch {
      result.set(b.index, sanitizeTranslation(b.text));
    }
  }
  return result;
}

/** 划词翻译：词典式释义 + 上下文解释（JSON） */
const SELECTION_SYSTEM_PROMPT = `你是专业的英汉词典与翻译助手。用户划选了网页上的英文，并提供了页面上下文。
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

/**
 * 划词翻译
 * @param {{ apiKey: string, model?: string, text: string, context?: string }} opts
 */
export async function translateSelection({ apiKey, model = DEFAULT_MODEL, text, context = "" }) {
  if (!apiKey?.trim()) throw new Error("请先在扩展选项中配置 DeepSeek API Key");

  const raw = await chatCompletion({
    apiKey,
    model,
    temperature: 0.3,
    messages: [
      { role: "system", content: SELECTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: `划选英文：\n${text}\n\n网页上下文（节选）：\n${(context || "").slice(0, 800)}`,
      },
    ],
  });

  let s = raw.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fence) s = fence[1].trim();
  const objMatch = s.match(/\{[\s\S]*\}/);
  if (objMatch) s = objMatch[0];

  try {
    const data = JSON.parse(s);
    return {
      term: data.term || text,
      phonetic: data.phonetic || "",
      partOfSpeech: data.partOfSpeech || "",
      briefDefinition: data.briefDefinition || "",
      exampleEn: data.exampleEn || "",
      exampleZh: data.exampleZh || "",
      contextExplanation: data.contextExplanation || data.briefDefinition || "",
    };
  } catch {
    return {
      term: text,
      phonetic: "",
      partOfSpeech: "",
      briefDefinition: raw,
      exampleEn: "",
      exampleZh: "",
      contextExplanation: raw,
    };
  }
}
