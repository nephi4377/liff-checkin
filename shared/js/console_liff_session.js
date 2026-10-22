/**
 * project-console（主控台）LIFF ID token：讀寫與 Hub 通知 API 頂層帶 liff_id_token。
 * 後端開關 off 時不帶 token 仍可運作；token 過期時觸發既有重登流程。
 *
 * GET 讀取為何把 liff_id_token 放在 URL query（暫不改成 header／POST）：
 * - project-console 讀取走 GAS doGet（page=…），前端用無 preflight 的 GET fetch。
 * - Authorization 或自訂 header 會觸發 CORS preflight，GAS Web App 對預檢支援不完整，歷史上已改用 FormData POST 避開。
 * - 讀取若改 POST 需後端新增 doPost 路由並與 #189 範圍分開；短期維持 query，並只帶仍有效的 token。
 */
import { CONFIG } from './config.js';

const LIFF_TOKEN_SKEW_SEC = 60;
const PARENT_TOKEN_WAIT_MS = 1200;
const PARENT_TOKEN_ATTEMPTS = 2;
const PARENT_TOKEN_RETRY_DELAY_MS = 100;
const RELOGIN_COOLDOWN_MS = 2 * 60 * 1000;
const RELOGIN_AT_KEY = 'console_liff_relogin_at';
const RETURN_HASH_KEY = 'console_liff_return_hash';

let cachedToken = '';

/** postMessage 是否來自與本頁相同 origin（Hub／iframe 同源政策） */
export function isTrustedHubMessageOrigin(origin) {
  try {
    return origin === window.location.origin;
  } catch (e) {
    return false;
  }
}

function decodeJwtPayload_(token) {
  try {
    if (!token) return null;
    const parts = String(token).split('.');
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = decodeURIComponent(Array.prototype.map.call(atob(b64), (c) =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

export function isLiffIdTokenFresh(token) {
  if (!token) return false;
  const payload = decodeJwtPayload_(token);
  if (!payload || payload.exp == null) return false;
  const expSec = parseInt(payload.exp, 10) || 0;
  if (!expSec) return false;
  return expSec > (Math.floor(Date.now() / 1000) + LIFF_TOKEN_SKEW_SEC);
}

function readLiffIdTokenRaw_() {
  try {
    if (typeof liff === 'undefined' || !liff.getIDToken) return '';
    return liff.getIDToken() || '';
  } catch (e) {
    return '';
  }
}

function refreshFromLiffSdk_() {
  try {
    const t = readLiffIdTokenRaw_();
    if (t && isLiffIdTokenFresh(t)) {
      cachedToken = t;
      return t;
    }
    if (t && !isLiffIdTokenFresh(t)) cachedToken = '';
  } catch (e) {
    console.warn('[ConsoleLiff] refreshFromLiffSdk:', e);
  }
  if (cachedToken && isLiffIdTokenFresh(cachedToken)) return cachedToken;
  return '';
}

function maybeReloginOnExpiredStandalone_(opts) {
  if (opts.attemptReloginOnExpired === false) return false;
  if (isConsoleEmbeddedInHub_()) return false;
  const raw = readLiffIdTokenRaw_();
  if (!raw || isLiffIdTokenFresh(raw)) return false;
  return requestConsoleLiffRelogin();
}

function getHubMessageTarget_() {
  try {
    if (window.top && window.top !== window) return window.top;
  } catch (e) { /* cross-origin */ }
  return (window.parent && window.parent !== window) ? window.parent : null;
}

export function isConsoleEmbeddedInHub_() {
  try {
    if (window.parent === window) return false;
    const q = new URLSearchParams(window.location.search);
    return !!(q.get('uid') || q.get('hub_liff_id'));
  } catch (e) {
    return false;
  }
}

function requestParentHubLiffTokenOnce_() {
  const target = getHubMessageTarget_();
  if (!target) return Promise.resolve('');
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; resolve(''); }
    }, PARENT_TOKEN_WAIT_MS);
    function onMsg(e) {
      if (!isTrustedHubMessageOrigin(e.origin)) return;
      if (!e.data || e.data.type !== 'hub_liff_token') return;
      if (done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener('message', onMsg);
      resolve(e.data.token || '');
    }
    window.addEventListener('message', onMsg);
    try {
      target.postMessage({ type: 'request_hub_liff_token' }, window.location.origin);
    } catch (err) {
      clearTimeout(timer);
      window.removeEventListener('message', onMsg);
      resolve('');
    }
  });
}

async function requestParentHubLiffToken_(opts = {}) {
  const attempts = opts.attempts ?? PARENT_TOKEN_ATTEMPTS;
  const delayMs = opts.delayMs ?? PARENT_TOKEN_RETRY_DELAY_MS;
  for (let i = 0; i < attempts; i++) {
    const tok = await requestParentHubLiffTokenOnce_();
    if (tok && isLiffIdTokenFresh(tok)) {
      cachedToken = tok;
      return tok;
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return '';
}

/**
 * 取得可用的 project-console LIFF ID token（不強制；無 token 時回傳空字串）。
 */
export async function getConsoleLiffIdToken(opts = {}) {
  if (!isLiffIdTokenFresh(cachedToken)) cachedToken = '';

  const fromLiff = refreshFromLiffSdk_();
  if (fromLiff) return fromLiff;

  const allowParent = opts.allowParent !== false;
  if (allowParent && isConsoleEmbeddedInHub_()) {
    const fromParent = await requestParentHubLiffToken_(opts.parent || {});
    if (fromParent) return fromParent;
    // iframe：父頁可能剛刷新 token，再試一次本頁 LIFF
    const retryLiff = refreshFromLiffSdk_();
    if (retryLiff) return retryLiff;
  }

  maybeReloginOnExpiredStandalone_(opts);
  return '';
}

export function mergeConsoleLiffAuth(target, token) {
  const out = target && typeof target === 'object' ? { ...target } : {};
  if (token && isLiffIdTokenFresh(token)) {
    out.liff_id_token = token;
  }
  return out;
}

export function appendConsoleLiffToUrl(url, token) {
  if (!token || !isLiffIdTokenFresh(token)) return url;
  const u = url instanceof URL ? url : new URL(String(url));
  // 見檔案頂部說明：讀取 API 暫用 query 帶 token（GAS GET／CORS 限制）
  u.searchParams.set('liff_id_token', token);
  return u;
}

const LIFF_FAIL_RE = /LIFF\s*驗證失敗|缺少\s*liff_id_token|id\s*token\s*expir|ID\s*token\s*expir|無效的\s*LIFF/i;

export function isConsoleLiffSessionError(message) {
  return LIFF_FAIL_RE.test(String(message || ''));
}

/**
 * 主控台／iframe：token 失效時重登（2 分鐘內不重複，除非 force）。
 * @returns {boolean} 是否已啟動重登流程
 */
export function requestConsoleLiffRelogin(opts = {}) {
  try {
    const last = parseInt(sessionStorage.getItem(RELOGIN_AT_KEY) || '0', 10) || 0;
    if (!opts.force && last && (Date.now() - last) < RELOGIN_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOGIN_AT_KEY, String(Date.now()));
    if (window.location.hash && window.location.hash !== '#') {
      sessionStorage.setItem(RETURN_HASH_KEY, window.location.hash);
    }
  } catch (e) { /* ignore */ }

  cachedToken = '';

  if (isConsoleEmbeddedInHub_()) {
    const target = getHubMessageTarget_();
    if (target) {
      try {
        target.postMessage({ type: 'request_hub_liff_relogin', force: !!opts.force }, window.location.origin);
        return true;
      } catch (e2) {
        console.warn('[ConsoleLiff] request_hub_liff_relogin:', e2);
      }
    }
  }

  try {
    if (typeof liff === 'undefined') {
      window.location.reload();
      return true;
    }
    try { if (liff.isLoggedIn && liff.isLoggedIn()) liff.logout(); } catch (eOut) { /* ignore */ }
    let inClient = false;
    try { inClient = !!(liff.isInClient && liff.isInClient()); } catch (eIn) { /* ignore */ }
    if (inClient) {
      window.location.reload();
    } else {
      liff.login({ redirectUri: window.location.href });
    }
  } catch (e) {
    console.warn('[ConsoleLiff] relogin:', e);
    window.location.reload();
  }
  return true;
}

export function restoreConsoleHashAfterRelogin() {
  try {
    const back = sessionStorage.getItem(RETURN_HASH_KEY);
    if (!back) return;
    sessionStorage.removeItem(RETURN_HASH_KEY);
    if (/^#\/[\w\-\/?=&%.]*$/.test(back) && (!window.location.hash || window.location.hash === '#')) {
      window.location.hash = back;
    }
  } catch (e) { /* ignore */ }
}

export function primeConsoleLiffFromParentMessage(token, eventOrigin) {
  if (eventOrigin != null && !isTrustedHubMessageOrigin(eventOrigin)) return false;
  if (token && isLiffIdTokenFresh(token)) {
    cachedToken = token;
    return true;
  }
  if (token && !isLiffIdTokenFresh(token)) cachedToken = '';
  return false;
}
