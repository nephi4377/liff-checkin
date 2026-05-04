/**
 * 客戶端唯讀施工進度頁（SPEC/13）
 * - 資料：沿用 GET page=project（不修改後端）；施工項目細項另讀 Firebase `quotations/{案號}`（與 BudgetAuditor 相同）。
 * - 客戶端：**唯讀**；不提供標示完成、編輯內部項目表或任何寫入 Firebase／GAS。
 * - 快取：`localStorage` 保存 GAS 專案與 `quotations/{案號}` 快拍，7 日內先顯示再背景更新；`#sync-hint` 顯示「正在背景更新」。
 * - 版面／照片牆：對齊專案工作區（buildPhotoGridV2 + 燈箱）。
 *
 * 【僅本地開發】寫死測試用 userId／案號 —— 正式上線前請將 ENABLED 改為 false 並改走 LIFF／網址參數。
 */
import { CONFIG } from '/shared/js/config.js';
import { extractDriveFileId } from '/shared/js/utils.js';
import { buildPhotoGridV2, lazyLoadImages } from './ui.js';

/** @todo 正式對客上線前：改為 false，並完成客戶 LIFF／綁定 API */
const __DEV_CLIENT_DEFAULTS = {
  ENABLED: true,
  PROJECT_ID: '752',
  LINE_USER_ID: 'U12345',
};

const qs = new URLSearchParams(window.location.search);
const isLocal =
  qs.get('local') === '1' ||
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

const projectId = (
  qs.get('id') ||
  qs.get('project') ||
  (isLocal && __DEV_CLIENT_DEFAULTS.ENABLED ? __DEV_CLIENT_DEFAULTS.PROJECT_ID : '999')
).trim();

const manualUserId = (qs.get('userId') || qs.get('uid') || '').trim();

const subhead = document.getElementById('subhead');
const errorBanner = document.getElementById('error-banner');
const logList = document.getElementById('log-list');
const emptyHint = document.getElementById('empty-hint');
const syncHint = document.getElementById('sync-hint');

// ---------- 客戶端快取：GAS 專案與 Firebase quotations，7 天內可先用舊資料，背景再更新 ----------
const CLIENT_PROGRESS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LS_GAS_PREFIX = 'client_progress:gas:';
const LS_FB_PREFIX = 'client_progress:fb_audit:';

function cacheKeyGas(userId, projectNo) {
  return `${LS_GAS_PREFIX}${String(userId).trim()}:${String(projectNo).trim()}`;
}

function cacheKeyFb(projectNo) {
  return `${LS_FB_PREFIX}${String(projectNo).trim()}`;
}

function readCacheEntry(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function writeCacheEntry(key, payload) {
  try {
    localStorage.setItem(key, JSON.stringify({ t: Date.now(), payload }));
  } catch (e) {
    console.warn('[client-progress-cache]', e);
  }
}

function getValidCache(key) {
  const o = readCacheEntry(key);
  if (!o || typeof o.t !== 'number') return null;
  if (Date.now() - o.t > CLIENT_PROGRESS_CACHE_TTL_MS) return null;
  return o;
}

function setSyncHint(visible) {
  if (!syncHint) return;
  if (visible) syncHint.classList.remove('hidden');
  else syncHint.classList.add('hidden');
}

// ---------- 施工項目細項（與 tools/BudgetAuditor_Standalone 相同 RTDB 路徑；僅顯示完成度，不含單價／raw_line）----------
const FB_AUDIT_CONFIG_KEY = 'fb_audit_config';
const FB_DEFAULT_DB_URL =
  'https://brave-calling-391208-default-rtdb.asia-southeast1.firebasedatabase.app';

function readFbAuditConfig() {
  const base = { databaseURL: FB_DEFAULT_DB_URL, apiKey: '', authDomain: '', projectId: '' };
  try {
    Object.assign(base, JSON.parse(localStorage.getItem(FB_AUDIT_CONFIG_KEY) || '{}'));
  } catch (_) {
    /* ignore */
  }
  return base;
}

function firebaseAuthReady(c) {
  return !!(String(c.apiKey || '').trim() && String(c.authDomain || '').trim() && String(c.projectId || '').trim());
}

function ensureFirebaseApp() {
  const fb = window.firebase;
  if (!fb || typeof fb.initializeApp !== 'function') return false;
  if (fb.apps && fb.apps.length > 0) return true;
  const c = readFbAuditConfig();
  const opts = { databaseURL: (c.databaseURL || FB_DEFAULT_DB_URL).trim() };
  if (firebaseAuthReady(c)) {
    opts.apiKey = String(c.apiKey).trim();
    opts.authDomain = String(c.authDomain).trim();
    opts.projectId = String(c.projectId).trim();
  }
  fb.initializeApp(opts);
  if (firebaseAuthReady(c) && fb.auth) {
    fb.auth().signInAnonymously().catch(() => {});
  }
  return true;
}

function extractQuotationContext(fbVal) {
  if (!fbVal || typeof fbVal !== 'object') return null;
  if (fbVal.context && typeof fbVal.context === 'object' && Array.isArray(fbVal.context.items)) {
    return fbVal.context;
  }
  if (Array.isArray(fbVal.items)) return fbVal;
  return null;
}

function toNum(v, fallback = NaN) {
  if (v == null || v === '') return fallback;
  const n = parseFloat(String(v).replace(/%/g, '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : fallback;
}

function firstFinite(...vals) {
  for (const v of vals) {
    const n = toNum(v, NaN);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

function sanitizeItem(it) {
  if (!it || typeof it !== 'object') return null;
  const pct = toNum(it.completion_percent, 0);
  const done = it.is_ui_done === true || pct >= 100;
  return {
    id: String(it.id || '').trim(),
    name: String(it.name || '未命名工項').trim() || '未命名工項',
    zone: String(it.zone || '未分類區域').trim() || '未分類區域',
    completion_percent: Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0)),
    is_ui_done: done,
    is_cancelled: !!it.is_cancelled,
  };
}

function zoneHasIncomplete(list) {
  return list.some((i) => !i.is_cancelled && !i.is_ui_done);
}

/** 未完成 = 未取消且尚未勾完成（含進行中、尚未開始） */
function pendingDoneCounts(list) {
  const active = list.filter((i) => !i.is_cancelled);
  const done = active.filter((i) => i.is_ui_done).length;
  const pending = active.length - done;
  return { done, pending, total: active.length };
}

/** 單列狀態：已完成／已取消／尚未開始／進行中 */
function auditRowParts(it) {
  if (it.is_cancelled) {
    return {
      mark: '—',
      rowCls: 'client-audit-item opacity-70',
      statusLabel: '已取消',
      barHtml: '',
    };
  }
  if (it.is_ui_done) {
    return {
      mark: '✓',
      rowCls: 'client-audit-item done',
      statusLabel: '已完成',
      barHtml: '',
    };
  }
  const p = Math.round(it.completion_percent);
  if (p <= 0) {
    return {
      mark: '○',
      rowCls: 'client-audit-item not-started',
      statusLabel: '尚未開始',
      barHtml: '',
    };
  }
  const w = Math.min(100, Math.max(0, p));
  return {
    mark: '<span style="color:var(--primary);font-size:0.85rem;font-weight:700" aria-hidden="true">▸</span>',
    rowCls: 'client-audit-item in-progress',
    statusLabel: `進行中（${w}%）`,
    barHtml: `<div class="client-audit-mini-bar" role="presentation"><span class="client-audit-mini-bar-fill" style="width:${w}%"></span></div>`,
  };
}

/** 摺疊列右側：未完成／已完成（對客用詞） */
function formatPendingDoneCountsHtml(c) {
  return `<span class="cnt-pending">未完成 ${escapeHtml(String(c.pending))}</span><span class="cnt-sep">·</span><span class="cnt-done">已完成 ${escapeHtml(String(c.done))}</span>`;
}

function buildAuditPanelHtml(overview, ctx) {
  const sumSheet = overview || {};
  const sumFb = ctx && ctx.total_summary ? ctx.total_summary : {};
  const rawItems = ctx && Array.isArray(ctx.items) ? ctx.items : [];
  const items = rawItems.map(sanitizeItem).filter(Boolean);

  let total = firstFinite(sumFb.audit_items_total, sumSheet.audit_items_total);
  let verified = firstFinite(sumFb.audit_items_verified, sumSheet.audit_items_verified);
  let pct = firstFinite(sumFb.audit_percent, sumFb.overall_completion, sumSheet.audit_percent);

  if (items.length && (!Number.isFinite(total) || !Number.isFinite(verified) || !Number.isFinite(pct))) {
    if (!Number.isFinite(total)) total = items.filter((i) => !i.is_cancelled).length;
    if (!Number.isFinite(verified)) {
      verified = items.filter((i) => i.is_ui_done && !i.is_cancelled).length;
    }
    if (!Number.isFinite(pct) && Number.isFinite(total) && total > 0) {
      pct = (verified / total) * 100;
    }
  }

  const hasItems = items.length > 0;
  const hasSheetSignal =
    hasItems ||
    Number.isFinite(total) ||
    Number.isFinite(verified) ||
    Number.isFinite(pct);

  const countsFromItems = hasItems ? pendingDoneCounts(items) : null;
  const countsFromSheet =
    !hasItems && Number.isFinite(total) && Number.isFinite(verified)
      ? {
          done: Math.min(Math.round(verified), Math.round(total)),
          pending: Math.max(0, Math.round(total) - Math.round(verified)),
          total: Math.round(total),
        }
      : null;
  let summaryCountsHtml = '<span class="muted" style="font-weight:500">點開查看</span>';
  if (countsFromItems) summaryCountsHtml = formatPendingDoneCountsHtml(countsFromItems);
  else if (countsFromSheet) summaryCountsHtml = formatPendingDoneCountsHtml(countsFromSheet);

  const customerNote =
    '<p class="muted text-sm m-0 mb-3" style="border-left:3px solid #e5e7eb;padding-left:0.65rem">此區為<strong>項目清單</strong>，與公司內部表單<strong>同步顯示</strong>（無法在此更新）。您關心的<strong>現場狀況</strong>請以<strong>下方</strong>「現場施工紀錄」為主。</p>';

  if (!hasSheetSignal) {
    return `<details class="client-audit-collapse-root">
      <summary class="client-audit-collapse-summary">
        <span class="client-audit-collapse-title">施工項目</span>
        <span class="client-audit-collapse-counts muted" style="font-weight:500">尚無同步資料</span>
      </summary>
      <div class="client-audit-collapse-body">
        ${customerNote}
        <div class="client-audit-inner-quiet"><p class="m-0 muted text-sm">公司於內部系統同步後，這裡會出現各區<strong>施工項目</strong>的完成狀況（您無法在此修改）。若表單摘要已寫入，之後也會一併反映。</p></div>
      </div>
    </details>`;
  }

  let bodyInner = customerNote;

  if (Number.isFinite(total) || Number.isFinite(verified) || Number.isFinite(pct)) {
    const tStr = Number.isFinite(total) ? String(Math.round(total)) : '—';
    const vStr = Number.isFinite(verified) ? String(Math.round(verified)) : '—';
    const pRound = Number.isFinite(pct) ? Math.min(100, Math.max(0, Math.round(pct))) : 0;
    const pStr = Number.isFinite(pct) ? `${pRound}%` : '—';
    const remain =
      Number.isFinite(total) && Number.isFinite(verified) ? Math.max(0, Math.round(total - verified)) : null;
    const barBlock = Number.isFinite(pct)
      ? `<div class="client-audit-overall-bar" role="img" aria-label="項目整體約 ${pRound}%"><div class="client-audit-overall-bar-fill" style="width:${pRound}%"></div></div>
         <div class="client-audit-overall-scale"><span>0%</span><span>${escapeHtml(pStr)}</span><span>100%</span></div>`
      : '';
    const remainLine =
      remain != null
        ? `<p class="muted text-sm m-0 mt-2">其中 <strong>${escapeHtml(String(remain))}</strong> 項尚未完成（含進行中與尚未開始）。</p>`
        : '';
    bodyInner += `<div class="card client-audit-summary client-audit-summary--compact mb-3">
      <p class="m-0 text-sm muted">以下數字與公司內部<strong>施工項目表</strong>同步；分區標題可再點開看細項。</p>
      <div class="client-audit-summary-metrics">
        <div class="client-audit-metric">
          <span class="client-audit-metric-label">已完成</span>
          <div class="audit-pct client-audit-metric-value">${escapeHtml(vStr)}</div>
        </div>
        <div class="client-audit-metric">
          <span class="client-audit-metric-label">總項目</span>
          <div class="audit-pct client-audit-metric-value">${escapeHtml(tStr)}</div>
        </div>
        <div class="client-audit-metric">
          <span class="client-audit-metric-label">整體比例</span>
          <div class="audit-pct client-audit-metric-value">${escapeHtml(pStr)}</div>
        </div>
      </div>
      ${barBlock}
      ${remainLine}
    </div>`;
  }

  if (!hasItems) {
    bodyInner += `<p class="muted text-sm m-0">目前僅有表單上的摘要數字。細項清單須等雲端寫入 <code>quotations/${escapeHtml(projectId)}</code>（與公司審核工具相同）；匿名讀取時請在該工具「雲端設定」填齊 apiKey／authDomain／projectId，本頁會共用瀏覽器鍵 <code>fb_audit_config</code>。</p>`;
    return `<details class="client-audit-collapse-root">
      <summary class="client-audit-collapse-summary">
        <span class="client-audit-collapse-title">施工項目</span>
        <span class="client-audit-collapse-counts">${summaryCountsHtml}</span>
      </summary>
      <div class="client-audit-collapse-body">${bodyInner}</div>
    </details>`;
  }

  const zones = {};
  for (const it of items) {
    if (!zones[it.zone]) zones[it.zone] = [];
    zones[it.zone].push(it);
  }
  Object.keys(zones).forEach((z) => {
    zones[z].sort((a, b) => {
      if (a.is_cancelled !== b.is_cancelled) return a.is_cancelled ? 1 : -1;
      if (a.is_ui_done !== b.is_ui_done) return a.is_ui_done ? 1 : -1;
      if ((a.completion_percent || 0) !== (b.completion_percent || 0)) {
        return (b.completion_percent || 0) - (a.completion_percent || 0);
      }
      return a.name.localeCompare(b.name, 'zh-Hant');
    });
  });

  const zoneNames = Object.keys(zones);
  zoneNames.sort((a, b) => {
    const ia = zoneHasIncomplete(zones[a]);
    const ib = zoneHasIncomplete(zones[b]);
    if (ia !== ib) return ia ? -1 : 1;
    return a.localeCompare(b, 'zh-Hant');
  });

  bodyInner += '<div class="card client-audit-zones-card">';
  zoneNames.forEach((zoneName) => {
    const list = zones[zoneName];
    const zc = pendingDoneCounts(list);
    const badge = zc.total > 0 ? `未完成 ${zc.pending} · 已完成 ${zc.done}` : '';
    bodyInner += `<details class="client-audit-zone">`;
    bodyInner += `<summary class="client-audit-zone-summary"><span class="client-audit-zone-title">${escapeHtml(zoneName)}</span><span class="client-audit-zone-badge">${escapeHtml(badge)}</span></summary>`;
    bodyInner += '<div class="client-audit-zone-body">';
    list.forEach((it) => {
      const parts = auditRowParts(it);
      bodyInner += `<div class="${parts.rowCls}">
        <div class="done-mark">${parts.mark}</div>
        <div class="item-body">
          <div class="item-name">${escapeHtml(it.name)}</div>
          <div class="item-meta">${escapeHtml(parts.statusLabel)}</div>
          ${parts.barHtml}
        </div>
      </div>`;
    });
    bodyInner += '</div></details>';
  });
  bodyInner += '</div>';

  return `<details class="client-audit-collapse-root">
    <summary class="client-audit-collapse-summary">
      <span class="client-audit-collapse-title">施工項目</span>
      <span class="client-audit-collapse-counts">${summaryCountsHtml}</span>
    </summary>
    <div class="client-audit-collapse-body">${bodyInner}</div>
  </details>`;
}

async function fetchFirebaseQuotationContext(projectNo) {
  if (!window.firebase) return null;
  if (!ensureFirebaseApp()) return null;
  const snap = await window.firebase.database().ref(`quotations/${String(projectNo).trim()}`).once('value');
  return extractQuotationContext(snap.val());
}

function paintAuditPanel(overview, ctx) {
  const panel = document.getElementById('client-audit-panel');
  if (!panel) return;
  panel.innerHTML = buildAuditPanelHtml(overview || {}, ctx);
}

function showError(msg) {
  errorBanner.textContent = msg;
  errorBanner.classList.remove('hidden');
  subhead.textContent = '無法載入';
}

/** 與 main.js initializeLightbox 一致，供 buildPhotoGridV2 點擊與鍵盤切換 */
function setupLightbox() {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox || lightbox.dataset.initialized === '1') return;

  const lightboxImg = lightbox.querySelector('.lb-img');
  const closeBtn = lightbox.querySelector('.lb-close');
  const wrap = lightbox.querySelector('.lb-wrap');
  if (!lightboxImg || !closeBtn || !wrap) return;

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'lb-prev';
  prevBtn.setAttribute('aria-label', '上一張');
  prevBtn.innerHTML = '&#10094;';
  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'lb-next';
  nextBtn.setAttribute('aria-label', '下一張');
  nextBtn.innerHTML = '&#10095;';
  wrap.append(prevBtn, nextBtn);

  let currentImages = [];
  let currentIndex = 0;

  function showImage(index) {
    if (!currentImages || currentImages.length === 0) return;
    currentIndex = index;
    lightboxImg.src = currentImages[currentIndex];
    const showNav = currentImages.length > 1;
    prevBtn.style.display = showNav ? 'block' : 'none';
    nextBtn.style.display = showNav ? 'block' : 'none';
  }

  function openLightbox(urls, index) {
    currentImages = urls;
    showImage(index);
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', handleKeydown);
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    lightboxImg.src = '';
    currentImages = [];
    document.removeEventListener('keydown', handleKeydown);
  }

  function showPrev() {
    const n = currentImages.length;
    if (n < 1) return;
    showImage((currentIndex - 1 + n) % n);
  }

  function showNext() {
    const n = currentImages.length;
    if (n < 1) return;
    showImage((currentIndex + 1) % n);
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showPrev();
    if (e.key === 'ArrowRight') showNext();
  }

  closeBtn.addEventListener('click', closeLightbox);
  prevBtn.addEventListener('click', showPrev);
  nextBtn.addEventListener('click', showNext);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  window.__openLightbox__ = openLightbox;
  lightbox.dataset.initialized = '1';
}

/** 僅展示已發布（與主控台一致） */
function filterPublishedLogs(dailyLogs) {
  if (!Array.isArray(dailyLogs)) return [];
  return dailyLogs.filter((log) => {
    const st = log.Status != null ? String(log.Status).trim() : '';
    return st === '' || st === '已發布';
  });
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/**
 * 日誌卡片：結構對齊 ui._buildLogCard（無編輯／刪除／發布按鈕）
 */
function buildReadonlyLogCard(log) {
  const card = document.createElement('div');
  card.className = 'card';
  card.id = 'log-' + log.LogID;

  const timestamp = log.Timestamp
    ? new Date(log.Timestamp).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
    : '-';
  const displayContent = String(log.Content || '無內容').replace(/^\[更新 .*?\]\n/, '');

  const headerDiv = document.createElement('div');
  headerDiv.className = 'log-card-header';
  headerDiv.innerHTML = `
    <h3>${escapeHtml(log.Title || '無標題')} <span class="muted">by ${escapeHtml(log.UserName || '未知')}</span></h3>
    <small class="muted">${escapeHtml(timestamp)}</small>
  `;

  const contentDiv = document.createElement('div');
  contentDiv.id = 'content-' + log.LogID;
  contentDiv.style.whiteSpace = 'pre-wrap';
  contentDiv.style.marginTop = '0.75rem';
  contentDiv.textContent = displayContent;

  card.appendChild(headerDiv);
  card.appendChild(contentDiv);

  if (log.PhotoLinks) {
    const photoGrid = buildPhotoGridV2(log.PhotoLinks);
    const photoContainer = document.createElement('div');
    photoContainer.style.marginTop = '1rem';
    photoContainer.appendChild(photoGrid);
    card.appendChild(photoContainer);

    const allLinks = JSON.parse(photoGrid.dataset.allLinks || '[]');
    const fullUrls = allLinks.map((link) => {
      const u = (link || '').trim();
      const id = extractDriveFileId(u);
      return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1200` : u;
    });

    const images = photoGrid.querySelectorAll('img.photo-thumb');
    images.forEach((img) => {
      img.addEventListener('click', () => {
        const index = parseInt(img.dataset.index || '0', 10);
        if (window.__openLightbox__) window.__openLightbox__(fullUrls, index);
      });
    });
  }

  return card;
}

function renderLogs(logs) {
  logList.innerHTML = '';
  if (!logs.length) {
    emptyHint.classList.remove('hidden');
    return;
  }
  emptyHint.classList.add('hidden');

  for (const log of logs) {
    logList.appendChild(buildReadonlyLogCard(log));
  }
  lazyLoadImages();
}

async function resolveUserId() {
  if (isLocal) {
    const fromQuery = manualUserId;
    const baked = __DEV_CLIENT_DEFAULTS.ENABLED ? __DEV_CLIENT_DEFAULTS.LINE_USER_ID : '';
    const uid = fromQuery || baked;
    if (!uid) {
      showError('本地測試請在網址加上 &userId=（或 &uid=）有效的 LINE userId，否則後端會拒絕。');
      return null;
    }
    return uid;
  }

  const liffId = typeof window.CLIENT_PROGRESS_LIFF_ID === 'string' ? window.CLIENT_PROGRESS_LIFF_ID.trim() : '';
  if (!liffId) {
    showError('尚未設定客戶用 LIFF ID（HTML 內 CLIENT_PROGRESS_LIFF_ID）。請先用本地模式或帶 ?local=1。');
    return null;
  }

  const L = window.liff;
  if (!L) throw new Error('LIFF SDK 未載入');
  await L.init({ liffId });
  if (!L.isLoggedIn()) {
    L.login();
    return null;
  }
  const profile = await L.getProfile();
  return profile.userId;
}

async function fetchProject(userId) {
  const url = new URL(CONFIG.GAS_WEB_APP_URL);
  url.searchParams.set('page', 'project');
  url.searchParams.set('id', projectId);
  url.searchParams.set('userId', userId);

  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.success === false) throw new Error(json.message || '讀取失敗');
  const data = json.data;
  if (!data) throw new Error('回傳無 data');
  return data;
}

async function main() {
  setupLightbox();
  subhead.textContent = `案號 ${projectId}`;

  let userId;
  try {
    userId = await resolveUserId();
  } catch (e) {
    showError(e.message || String(e));
    return;
  }
  if (!userId) return;

  const kGas = cacheKeyGas(userId, projectId);
  const kFb = cacheKeyFb(projectId);
  const gasEntry = getValidCache(kGas);
  const fbEntry = getValidCache(kFb);
  const auditPanel = document.getElementById('client-audit-panel');

  let usedCache = false;
  if (gasEntry && gasEntry.payload) {
    usedCache = true;
    setSyncHint(true);
    const data = gasEntry.payload;
    const logs0 = filterPublishedLogs(data.dailyLogs || []);
    renderLogs(logs0);
    subhead.textContent = `案號 ${projectId} · 已發布紀錄 ${logs0.length} 則`;
    if (fbEntry && fbEntry.payload && Object.prototype.hasOwnProperty.call(fbEntry.payload, 'ctx')) {
      paintAuditPanel(data.overview || {}, fbEntry.payload.ctx);
    } else if (auditPanel) {
      auditPanel.innerHTML = '<p class="muted text-sm m-0">載入施工項目…</p>';
    }
  }

  try {
    if (!usedCache && auditPanel) {
      auditPanel.innerHTML = '<p class="muted text-sm m-0">載入施工項目…</p>';
    }

    const data = await fetchProject(userId);
    writeCacheEntry(kGas, data);

    let ctx;
    try {
      ctx = await fetchFirebaseQuotationContext(projectId);
      writeCacheEntry(kFb, { ctx });
    } catch (e) {
      console.warn('[client-audit]', e);
      const prev = getValidCache(kFb);
      ctx =
        prev && prev.payload && Object.prototype.hasOwnProperty.call(prev.payload, 'ctx')
          ? prev.payload.ctx
          : null;
    }

    setSyncHint(false);
    paintAuditPanel(data.overview || {}, ctx);

    const logs = filterPublishedLogs(data.dailyLogs || []);
    renderLogs(logs);
    subhead.textContent = `案號 ${projectId} · 已發布紀錄 ${logs.length} 則`;
  } catch (e) {
    setSyncHint(false);
    if (usedCache && gasEntry && gasEntry.payload) {
      const d = gasEntry.payload;
      if (fbEntry && fbEntry.payload && Object.prototype.hasOwnProperty.call(fbEntry.payload, 'ctx')) {
        paintAuditPanel(d.overview || {}, fbEntry.payload.ctx);
      } else {
        paintAuditPanel(d.overview || {}, null);
      }
      console.warn('[client-progress] 背景更新失敗，仍顯示快取', e);
      return;
    }
    showError(e.message || String(e));
  }
}

main();
