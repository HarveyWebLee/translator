/**
 * 内容脚本：英文页检测、横幅、整页逐步翻译。
 * 不使用 React，纯 TS + 原生 DOM，避免注入页体积膨胀。
 */

import './styles.css';

import { detectEnglishPage } from '../shared/utils/language-detect';
import { isInsideSkipContainer } from '../shared/utils/skip-selector';

import type { BgMessage, SettingsResponse, StreamEnvelope } from '../background/messages';
import type { TranslateSegment, TranslateStreamEvent } from '@translator/shared-types';

const BANNER_ID = 'ds-translator-banner';
const ATTR_TRANSLATED = 'data-ds-translated';
const ATTR_ORIGINAL = 'data-ds-original';
const ATTR_TRANSLATING = 'data-ds-translating';

const VIEWPORT_PRELOAD_RATIO = 0.2;
const CHUNK_SIZE = 15;
const SCROLL_DEBOUNCE_MS = 120;

interface SessionState {
  active: boolean;
  banner: HTMLElement | null;
  observer: IntersectionObserver | null;
  mutationObserver: MutationObserver | null;
  scrollTimer: number | undefined;
  mutationTimer: number | undefined;
  registry: { node: Text; parent: HTMLElement }[];
  translatedCount: number;
  totalEnglishNodes: number;
  streamId: string;
  pendingByIndex: Map<number, Text>;
}

const session: SessionState = {
  active: false,
  banner: null,
  observer: null,
  mutationObserver: null,
  scrollTimer: undefined,
  mutationTimer: undefined,
  registry: [],
  translatedCount: 0,
  totalEnglishNodes: 0,
  streamId: '',
  pendingByIndex: new Map(),
};

function sendBg<T = unknown>(msg: BgMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (res: { ok: boolean; data?: T; error?: string }) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!res?.ok) {
        reject(new Error(res?.error ?? '后台无响应'));
        return;
      }
      resolve(res.data as T);
    });
  });
}

function escapeHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ---------- 文本节点收集 ----------
function collectTextNodes(root?: HTMLElement): Text[] {
  const r = root ?? document.body;
  if (!r) return [];
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(r, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement;
      if (!parent || isInsideSkipContainer(node)) return NodeFilter.FILTER_REJECT;
      if (parent.closest(`[${ATTR_TRANSLATED}]`)) return NodeFilter.FILTER_REJECT;
      if (parent.hasAttribute(ATTR_TRANSLATING)) return NodeFilter.FILTER_REJECT;
      try {
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }
      } catch {
        /* ignore */
      }
      const t = node.textContent?.trim();
      if (!t || t.length < 2) return NodeFilter.FILTER_REJECT;
      if (!/[a-zA-Z]/.test(t)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let cur = walker.nextNode();
  while (cur) {
    nodes.push(cur as Text);
    cur = walker.nextNode();
  }
  return nodes;
}

function refreshRegistry(): void {
  const nodes = collectTextNodes();
  session.registry = nodes.map((node) => ({ node, parent: node.parentElement as HTMLElement }));
  session.totalEnglishNodes = session.translatedCount + nodes.length;
}

function zoneBottomPx(): number {
  return window.innerHeight * (1 + VIEWPORT_PRELOAD_RATIO);
}

function isInZone(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < zoneBottomPx();
}

function getPendingInZone(): Text[] {
  const out: Text[] = [];
  for (const it of session.registry) {
    if (!it.node.isConnected || !it.parent.isConnected) continue;
    if (it.parent.hasAttribute(ATTR_TRANSLATED) || it.parent.hasAttribute(ATTR_TRANSLATING))
      continue;
    if (isInZone(it.parent)) out.push(it.node);
  }
  return out;
}

function updateBanner(extra?: string): void {
  if (!session.banner) return;
  const meta = session.banner.querySelector<HTMLSpanElement>('.ds-translator-banner__meta');
  const strong = session.banner.querySelector<HTMLElement>('.ds-translator-banner__text strong');
  if (strong) strong.textContent = '逐步翻译中';
  if (meta) {
    meta.textContent = `已译 ${session.translatedCount} / ${session.totalEnglishNodes} 段 · 视口内优先${extra ? ' · ' + extra : ''}`;
  }
}

function applyTranslation(node: Text, zh: string): void {
  if (!node || !zh) return;
  const parent = node.parentElement;
  if (parent) {
    if (!parent.hasAttribute(ATTR_ORIGINAL)) {
      parent.setAttribute(ATTR_ORIGINAL, node.textContent ?? '');
    }
    parent.removeAttribute(ATTR_TRANSLATING);
    parent.setAttribute(ATTR_TRANSLATED, '1');
  }
  node.textContent = zh;
  session.translatedCount++;
}

// ---------- 翻译调度（SSE 流） ----------
let translating = false;

async function flushQueue(settings: SettingsResponse): Promise<void> {
  if (!session.active || translating) return;
  const pending = getPendingInZone().slice(0, CHUNK_SIZE);
  if (pending.length === 0) {
    updateBanner();
    checkComplete();
    return;
  }
  translating = true;
  for (const n of pending) n.parentElement?.setAttribute(ATTR_TRANSLATING, '1');

  // 批次内 segment index 全局递增
  const baseIndex = session.totalEnglishNodes - session.registry.length + session.translatedCount;
  const segments: TranslateSegment[] = pending.map((node, i) => {
    const idx = baseIndex + i;
    session.pendingByIndex.set(idx, node);
    return { index: idx, text: node.textContent ?? '' };
  });

  updateBanner('翻译中…');

  try {
    await sendBg({
      type: 'START_TRANSLATE_STREAM',
      streamId: session.streamId,
      payload: {
        providerId: settings.currentProvider,
        modelId: settings.currentModel,
        segments,
        targetLang: settings.targetLang,
      },
    });
  } catch (e) {
    for (const n of pending) n.parentElement?.removeAttribute(ATTR_TRANSLATING);
    translating = false;
    alert(`翻译失败：${(e as Error).message}`);
  }
}

function handleStreamEvent(event: TranslateStreamEvent): void {
  if (event.type === 'segment-done') {
    const node = session.pendingByIndex.get(event.segmentIndex);
    if (node) {
      applyTranslation(node, event.text);
      session.pendingByIndex.delete(event.segmentIndex);
      updateBanner();
    }
  } else if (event.type === 'done') {
    translating = false;
    // 处理下批
    void runNext();
  } else if (event.type === 'error') {
    translating = false;
    console.warn('[translator] stream error:', event.message);
    for (const node of session.pendingByIndex.values()) {
      node.parentElement?.removeAttribute(ATTR_TRANSLATING);
    }
    session.pendingByIndex.clear();
  }
}

async function runNext(): Promise<void> {
  if (!session.active) return;
  const more = getPendingInZone();
  if (more.length > 0) {
    const settings = await sendBg<SettingsResponse>({ type: 'GET_SETTINGS' });
    void flushQueue(settings);
  } else {
    checkComplete();
  }
}

function checkComplete(): void {
  refreshRegistry();
  const remaining = collectTextNodes().length;
  if (remaining === 0 && session.banner) {
    const strong = session.banner.querySelector<HTMLElement>('.ds-translator-banner__text strong');
    const meta = session.banner.querySelector<HTMLSpanElement>('.ds-translator-banner__meta');
    if (strong) strong.textContent = '翻译完成';
    if (meta) meta.textContent = '全文已译 · 刷新页面可恢复原文';
    teardown();
  }
}

// ---------- 观察器 ----------
function setupIO(): void {
  if (session.observer) session.observer.disconnect();
  const marginBottom = `${Math.round(VIEWPORT_PRELOAD_RATIO * 100)}%`;
  session.observer = new IntersectionObserver(
    () => {
      if (session.active) void runNext();
    },
    { root: null, rootMargin: `0px 0px ${marginBottom} 0px`, threshold: 0 },
  );
  const seen = new Set<Element>();
  for (const it of session.registry) {
    if (it.parent && !seen.has(it.parent)) {
      seen.add(it.parent);
      session.observer.observe(it.parent);
    }
  }
}

function setupMO(): void {
  if (session.mutationObserver) session.mutationObserver.disconnect();
  session.mutationObserver = new MutationObserver(() => {
    if (!session.active) return;
    window.clearTimeout(session.mutationTimer);
    session.mutationTimer = window.setTimeout(() => {
      refreshRegistry();
      setupIO();
      void runNext();
    }, 300);
  });
  session.mutationObserver.observe(document.body, { childList: true, subtree: true });
}

function onScroll(): void {
  if (!session.active) return;
  window.clearTimeout(session.scrollTimer);
  session.scrollTimer = window.setTimeout(() => void runNext(), SCROLL_DEBOUNCE_MS);
}

function teardown(): void {
  session.active = false;
  session.observer?.disconnect();
  session.mutationObserver?.disconnect();
  window.removeEventListener('scroll', onScroll);
  if (session.streamId) {
    void sendBg({ type: 'ABORT_TRANSLATE_STREAM', streamId: session.streamId });
  }
}

// ---------- 启动 ----------
async function startTranslation(banner: HTMLElement): Promise<void> {
  const settings = await sendBg<SettingsResponse>({ type: 'GET_SETTINGS' });
  if (!settings.hasAuth) {
    alert('请先在选项页登录后再翻译');
    chrome.runtime.openOptionsPage?.();
    return;
  }
  session.active = true;
  session.banner = banner;
  session.translatedCount = 0;
  session.pendingByIndex.clear();
  session.streamId = `s-${Date.now()}`;

  refreshRegistry();
  if (session.totalEnglishNodes === 0) {
    alert('未发现可翻译的英文文本');
    return;
  }

  setupIO();
  setupMO();
  window.addEventListener('scroll', onScroll, { passive: true });
  updateBanner();
  void flushQueue(settings);
}

// ---------- 横幅 UI ----------
function createBanner(reason: string, confidence: number): void {
  if (document.getElementById(BANNER_ID)) return;
  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  banner.className = 'ds-translator-banner';
  banner.innerHTML = `
    <div class="ds-translator-banner__inner">
      <span class="ds-translator-banner__icon">🌐</span>
      <div class="ds-translator-banner__text">
        <strong>检测到英文页面</strong>
        <span class="ds-translator-banner__meta">${escapeHtml(reason)} · 置信度 ${Math.round(confidence * 100)}%</span>
      </div>
      <div class="ds-translator-banner__actions">
        <button type="button" class="ds-btn ds-btn--primary" data-action="translate">翻译为中文</button>
        <button type="button" class="ds-btn ds-btn--ghost" data-action="dismiss">暂不翻译</button>
      </div>
    </div>
  `;
  banner
    .querySelector<HTMLButtonElement>('[data-action="translate"]')!
    .addEventListener('click', () => {
      void startTranslation(banner);
    });
  banner
    .querySelector<HTMLButtonElement>('[data-action="dismiss"]')!
    .addEventListener('click', () => {
      teardown();
      banner.remove();
      try {
        sessionStorage.setItem('ds-translator-dismissed', '1');
      } catch {
        /* ignore */
      }
    });
  document.documentElement.appendChild(banner);
}

async function runDetection(): Promise<void> {
  try {
    if (sessionStorage.getItem('ds-translator-dismissed')) return;
  } catch {
    /* ignore */
  }
  const settings = await sendBg<SettingsResponse>({ type: 'GET_SETTINGS' }).catch(() => null);
  if (!settings || !settings.enabled) return;
  const det = detectEnglishPage(document);
  if (!det.isEnglish) return;
  if (settings.autoPrompt) createBanner(det.reason, det.confidence);
}

function showManualBar(): void {
  const det = detectEnglishPage(document);
  createBanner(det.reason || '手动触发翻译', det.confidence || 0.5);
}

// ---------- 全局消息监听 ----------
chrome.runtime.onMessage.addListener((msg: BgMessage | StreamEnvelope) => {
  if ('type' in msg && msg.type === 'TRANSLATE_STREAM_EVENT') {
    handleStreamEvent((msg as StreamEnvelope).event);
    return;
  }
  if (msg.type === 'SHOW_TRANSLATE_BAR') showManualBar();
  if (msg.type === 'RUN_DETECT') void runDetection();
});

function schedule(): void {
  window.setTimeout(() => void runDetection(), 800);
  window.setTimeout(() => void runDetection(), 2500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', schedule);
} else {
  schedule();
}
