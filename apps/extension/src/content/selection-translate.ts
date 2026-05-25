/**
 * 划词翻译内容脚本（非 React）：
 * - 监听 mouseup，判断英文，调用后端 /translation/selection
 * - 在选区附近渲染浮动面板（含音标、释义、上下文解释）
 */

import './selection-panel.css';

import type { BgMessage, SettingsResponse } from '../background/messages';
import type { TranslateSelectionResponse } from '@translator/shared-types';

const PANEL_ID = 'ds-selection-panel';
const MAX_LEN = 400;
const DELAY_MS = 180;

interface State {
  enabled: boolean;
  panel: HTMLElement | null;
  pinned: boolean;
  lastText: string;
  timer: number | undefined;
}

const state: State = {
  enabled: false,
  panel: null,
  pinned: false,
  lastText: '',
  timer: undefined,
};

function sendBg<T = unknown>(msg: BgMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (res: { ok: boolean; data?: T; error?: string }) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!res?.ok) {
        reject(new Error(res?.error ?? '请求失败'));
        return;
      }
      resolve(res.data as T);
    });
  });
}

function isEnglish(text: string): boolean {
  if (!text.trim()) return false;
  const s = text.length > MAX_LEN ? text.slice(0, MAX_LEN) : text;
  let latin = 0;
  let cjk = 0;
  let total = 0;
  for (const ch of s) {
    if (/\s/.test(ch)) continue;
    total++;
    if (/[\u4e00-\u9fff]/.test(ch)) cjk++;
    else if (/[a-zA-Z]/.test(ch)) latin++;
  }
  if (total === 0) return false;
  if (cjk / total > 0.25) return false;
  return latin / total >= 0.45 || /[a-zA-Z]{2,}/.test(s);
}

function getContext(): string {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return '';
  const node = sel.anchorNode;
  if (!node) return '';
  const el = node.nodeType === Node.TEXT_NODE ? (node as Text).parentElement : (node as Element);
  if (!el) return '';
  const block = el.closest('p, li, td, th, h1, h2, h3, h4, h5, h6, article, section, div');
  const text = (block as HTMLElement | null)?.innerText ?? (el as HTMLElement).innerText ?? '';
  return text.replace(/\s+/g, ' ').trim().slice(0, 1200);
}

function getRect(): DOMRect | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  return sel.getRangeAt(0).getBoundingClientRect();
}

function escapeHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function removePanel(): void {
  state.pinned = false;
  state.panel?.remove();
  state.panel = null;
}

function position(panel: HTMLElement, rect: DOMRect): void {
  const w = panel.offsetWidth || 380;
  const h = panel.offsetHeight || 320;
  const gap = 10;
  let left = rect.left + rect.width / 2 - w / 2;
  let top = rect.bottom + gap;
  if (top + h > window.innerHeight - 8) top = rect.top - h - gap;
  left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
  top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

function renderLoading(panel: HTMLElement): void {
  panel.innerHTML = `
    <header class="ds-sel-panel__header">
      <div class="ds-sel-panel__brand">A</div>
      <div class="ds-sel-panel__tools">
        <button class="ds-sel-panel__icon-btn" data-action="pin" title="固定">📌</button>
        <button class="ds-sel-panel__icon-btn" data-action="close" title="关闭">✕</button>
      </div>
    </header>
    <div class="ds-sel-panel__body">
      <div class="ds-sel-panel__loading">正在翻译…</div>
    </div>
  `;
  bind(panel);
}

function render(panel: HTMLElement, data: TranslateSelectionResponse): void {
  panel.querySelector('.ds-sel-panel__body')!.innerHTML = `
    <h3 class="ds-sel-panel__term">${escapeHtml(data.term)}
      ${data.phonetic ? `<span class="ds-sel-panel__phonetic">${escapeHtml(data.phonetic)}</span>` : ''}
    </h3>
    <p class="ds-sel-panel__brief">${escapeHtml((data.partOfSpeech ? data.partOfSpeech + ' ' : '') + data.briefDefinition)}</p>
    ${
      data.exampleEn
        ? `<p class="ds-sel-panel__example">${escapeHtml(data.exampleEn)}<br>${escapeHtml(data.exampleZh)}</p>`
        : ''
    }
    <div class="ds-sel-panel__ai">${escapeHtml(data.contextExplanation)}</div>
  `;
}

function showError(panel: HTMLElement, msg: string): void {
  panel.querySelector('.ds-sel-panel__body')!.innerHTML =
    `<div class="ds-sel-panel__error">${escapeHtml(msg)}</div>`;
}

function bind(panel: HTMLElement): void {
  panel.addEventListener('mousedown', (e) => e.stopPropagation());
  panel
    .querySelector<HTMLButtonElement>('[data-action="close"]')
    ?.addEventListener('click', removePanel);
  panel.querySelector<HTMLButtonElement>('[data-action="pin"]')?.addEventListener('click', () => {
    state.pinned = !state.pinned;
  });
}

async function showFor(text: string, rect: DOMRect): Promise<void> {
  const settings = await sendBg<SettingsResponse>({ type: 'GET_SETTINGS' });
  if (!settings.hasAuth) {
    alert('请先在选项页登录');
    return;
  }

  removePanel();
  state.lastText = text;
  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.className = 'ds-sel-panel';
  renderLoading(panel);
  document.documentElement.appendChild(panel);
  state.panel = panel;
  position(panel, rect);

  try {
    const data = await sendBg<TranslateSelectionResponse>({
      type: 'TRANSLATE_SELECTION',
      payload: {
        providerId: settings.currentProvider,
        modelId: settings.currentModel,
        text,
        context: getContext(),
      },
    });
    if (state.panel === panel) {
      render(panel, data);
      const r = getRect();
      if (r) position(panel, r);
    }
  } catch (e) {
    if (state.panel === panel) showError(panel, (e as Error).message);
  }
}

function onMouseUp(): void {
  if (!state.enabled) return;
  window.clearTimeout(state.timer);
  state.timer = window.setTimeout(() => {
    if (state.panel && state.pinned) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      if (!state.pinned) removePanel();
      return;
    }
    if (state.panel && state.panel.contains(sel.anchorNode)) return;
    let text = sel.toString().trim();
    if (!text) {
      if (!state.pinned) removePanel();
      return;
    }
    if (text.length > MAX_LEN) text = text.slice(0, MAX_LEN);
    if (!isEnglish(text)) {
      if (!state.pinned) removePanel();
      return;
    }
    const r = getRect();
    if (!r) return;
    void showFor(text, r);
  }, DELAY_MS);
}

function onDocMouseDown(e: MouseEvent): void {
  if (!state.panel || state.pinned) return;
  if (state.panel.contains(e.target as Node)) return;
  removePanel();
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') removePanel();
}

function syncFlag(): void {
  chrome.storage.sync.get(['selectTranslate', 'enabled'], (data) => {
    state.enabled = data.enabled !== false && data.selectTranslate === true;
  });
}

function init(): void {
  syncFlag();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && (changes.selectTranslate || changes.enabled)) syncFlag();
  });
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('mousedown', onDocMouseDown);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener(
    'scroll',
    () => {
      if (state.panel && !state.pinned) removePanel();
    },
    { passive: true, capture: true },
  );
}

init();
