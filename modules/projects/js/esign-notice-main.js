/**
 * 簽約注意事項客戶頁：逐條「我了解」→ 手寫簽名 → 送出鎖定 → 可列印
 */
import { EsignNoticeApi } from './esign-notice-api.js';

const LIFF_ID = (typeof window !== 'undefined' && window.ESIGN_NOTICE_LIFF_ID) || '';

const qs = new URLSearchParams(window.location.search);
const hashParams = new URLSearchParams(String(window.location.hash || '').replace(/^#/, ''));

function param(name) {
  return qs.get(name) || hashParams.get(name) || '';
}

const projectNo = String(param('project_no') || param('id') || '').trim();
const staffPreview =
  param('staff_preview') === '1' ||
  param('staff_preview') === 'true' ||
  param('preview') === '1';
const isLocal =
  location.hostname === '127.0.0.1' ||
  location.hostname === 'localhost';

const state = {
  session: null,
  notice: null,
  noticeHash: '',
  record: null,
  stepIndex: 0, // 0..17
  mode: 'items', // items | sign | done | review
  busy: false,
};

const el = {
  boot: document.getElementById('boot'),
  app: document.getElementById('app'),
  msg: document.getElementById('msg'),
  heroSub: document.getElementById('heroSub'),
  versionBadge: document.getElementById('versionBadge'),
  lockedBanner: document.getElementById('lockedBanner'),
  stepCard: document.getElementById('stepCard'),
  signCard: document.getElementById('signCard'),
  doneCard: document.getElementById('doneCard'),
  stepNum: document.getElementById('stepNum'),
  statusLabel: document.getElementById('statusLabel'),
  itemTitle: document.getElementById('itemTitle'),
  itemBody: document.getElementById('itemBody'),
  itemImages: document.getElementById('itemImages'),
  itemFees: document.getElementById('itemFees'),
  itemExtras: document.getElementById('itemExtras'),
  btnPrev: document.getElementById('btnPrev'),
  btnAck: document.getElementById('btnAck'),
  btnClearSign: document.getElementById('btnClearSign'),
  btnBackItems: document.getElementById('btnBackItems'),
  btnSubmit: document.getElementById('btnSubmit'),
  btnPrint: document.getElementById('btnPrint'),
  btnReview: document.getElementById('btnReview'),
  doneMeta: document.getElementById('doneMeta'),
  printArea: document.getElementById('printArea'),
  canvas: document.getElementById('signCanvas'),
};

let drawing = false;
let ctx = null;
let hasInk = false;

function showMsg(text, ok) {
  if (!el.msg) return;
  el.msg.textContent = text || '';
  el.msg.classList.toggle('ok', !!ok);
}

function setBusy(on) {
  state.busy = !!on;
  [el.btnPrev, el.btnAck, el.btnSubmit, el.btnClearSign, el.btnBackItems, el.btnPrint, el.btnReview]
    .filter(Boolean)
    .forEach((b) => {
      b.disabled = !!on;
    });
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function authBody(extra) {
  const base = Object.assign(
    {
      project_no: projectNo,
      device_ua: navigator.userAgent || '',
    },
    extra || {}
  );
  if (staffPreview) {
    base.staff_preview = true;
    if (state.session && state.session.userId) base.userId = state.session.userId;
    if (state.session && state.session.idToken) base.liff_id_token = state.session.idToken;
    return base;
  }
  if (state.session) {
    if (state.session.uid) base.uid = state.session.uid;
    if (state.session.idToken) base.liff_id_token = state.session.idToken;
    if (state.session.accessToken) base.liff_access_token = state.session.accessToken;
    if (state.session.displayName) base.display_name = state.session.displayName;
  }
  return base;
}

async function initLiffSession() {
  if (staffPreview) {
    // 員工預覽：可走員工 LIFF；本機允許假身分
    if (isLocal && param('dev') === '1') {
      return { userId: 'Ustafflocal', displayName: '本機員工預覽', staff: true };
    }
    if (typeof liff === 'undefined') throw new Error('LIFF SDK 未載入');
    // 員工預覽仍用客戶 LIFF 開頁時，後端靠 staff_preview + 員工 token；此處先取 token
    await liff.init({ liffId: LIFF_ID });
    if (!liff.isLoggedIn()) {
      liff.login({ redirectUri: location.href });
      return null;
    }
    const idToken = (liff.getIDToken && liff.getIDToken()) || '';
    const profile = (liff.getProfile && (await liff.getProfile())) || {};
    return {
      userId: profile.userId || '',
      displayName: profile.displayName || '',
      idToken,
      staff: true,
    };
  }

  if (isLocal && param('dev') === '1') {
    return {
      uid: param('uid') || 'Ulocaltestlocaltestlocaltestloca',
      displayName: '本機測試客戶',
      idToken: '',
      accessToken: 'local-dev',
    };
  }

  if (!LIFF_ID) throw new Error('尚未設定客戶 LIFF ID');
  if (typeof liff === 'undefined') throw new Error('LIFF SDK 未載入');
  await liff.init({ liffId: LIFF_ID });
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: location.href });
    return null;
  }
  const idToken = (liff.getIDToken && liff.getIDToken()) || '';
  const accessToken = (liff.getAccessToken && liff.getAccessToken()) || '';
  let profile = {};
  try {
    profile = (await liff.getProfile()) || {};
  } catch (_) {}
  return {
    uid: profile.userId || '',
    displayName: profile.displayName || '',
    idToken,
    accessToken,
  };
}

function setupCanvas() {
  if (!el.canvas) return;
  ctx = el.canvas.getContext('2d');
  const rect = el.canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  el.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  el.canvas.height = Math.max(1, Math.floor(180 * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#111';
  hasInk = false;

  function pos(e) {
    const r = el.canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }
  function start(e) {
    e.preventDefault();
    drawing = true;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    hasInk = true;
  }
  function end() {
    drawing = false;
  }

  el.canvas.addEventListener('mousedown', start);
  el.canvas.addEventListener('mousemove', move);
  el.canvas.addEventListener('mouseup', end);
  el.canvas.addEventListener('mouseleave', end);
  el.canvas.addEventListener('touchstart', start, { passive: false });
  el.canvas.addEventListener('touchmove', move, { passive: false });
  el.canvas.addEventListener('touchend', end);
}

function clearCanvas() {
  if (!ctx || !el.canvas) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
  ctx.restore();
  hasInk = false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#111';
}

function currentItem() {
  const items = (state.notice && state.notice.items) || [];
  return items[state.stepIndex] || null;
}

function renderImages(item) {
  const images = (item && item.images) || [];
  if (!images.length) {
    el.itemImages.innerHTML = '';
    return;
  }
  el.itemImages.innerHTML = images
    .map((img) => {
      if (img.src) {
        return (
          '<div class="img-ph"><img src="' +
          escapeHtml(img.src) +
          '" alt="' +
          escapeHtml(img.caption || '') +
          '"/><div>' +
          escapeHtml(img.caption || '') +
          '</div></div>'
        );
      }
      return (
        '<div class="img-ph">圖片佔位<br/>' +
        escapeHtml(img.caption || '之後補圖') +
        (img.link
          ? '<br/><a href="' + escapeHtml(img.link) + '" target="_blank" rel="noopener">說明連結</a>'
          : '') +
        '</div>'
      );
    })
    .join('');
}

function renderFees(item) {
  const stages = (item && item.fee_stages) || [];
  if (!stages.length) {
    el.itemFees.innerHTML = '';
    return;
  }
  el.itemFees.innerHTML = stages
    .map(
      (s) =>
        '<article class="fee-card">' +
        '<h4>' +
        escapeHtml(s.stage) +
        '｜' +
        escapeHtml(s.work) +
        '</h4>' +
        '<p><span class="label">業主責任</span><br/>' +
        escapeHtml(s.owner) +
        '</p>' +
        '<p><span class="label">承攬方責任</span><br/>' +
        escapeHtml(s.contractor) +
        '</p>' +
        '<p><span class="label">取消時應付費用</span><br/>' +
        escapeHtml(s.cancel_fee) +
        '</p>' +
        '<p><span class="label">備註</span><br/>' +
        escapeHtml(s.note) +
        '</p>' +
        '</article>'
    )
    .join('');
}

function renderExtras(item) {
  const sections = (item && item.extra_sections) || [];
  if (!sections.length) {
    el.itemExtras.innerHTML = '';
    return;
  }
  el.itemExtras.innerHTML = sections
    .map((sec) => {
      const bullets = (sec.bullets || [])
        .map((b) => '<li>' + escapeHtml(b) + '</li>')
        .join('');
      return (
        '<div class="extra-sec"><h4>' +
        escapeHtml(sec.heading) +
        '</h4><ul>' +
        bullets +
        '</ul></div>'
      );
    })
    .join('');
}

function renderItem() {
  const item = currentItem();
  const total = ((state.notice && state.notice.items) || []).length || 18;
  el.stepNum.textContent = String(state.stepIndex + 1);
  el.statusLabel.textContent =
    (state.record && state.record.status_label) || '進行中';
  if (!item) return;
  el.itemTitle.textContent =
    item.title || '第 ' + item.id + ' 條';
  el.itemBody.textContent = item.body || '';
  renderImages(item);
  renderFees(item);
  renderExtras(item);
  el.btnPrev.disabled = state.busy || state.stepIndex <= 0 || !!(state.record && state.record.locked);
  const locked = !!(state.record && state.record.locked);
  el.btnAck.textContent = locked
    ? state.stepIndex >= total - 1
      ? '看簽名結果'
      : '下一條'
    : state.stepIndex >= total - 1
      ? '我了解，去簽名'
      : '我了解';
  el.btnAck.disabled = state.busy;
}

function showMode(mode) {
  state.mode = mode;
  el.stepCard.style.display = mode === 'items' || mode === 'review' ? 'block' : 'none';
  el.signCard.style.display = mode === 'sign' ? 'block' : 'none';
  el.doneCard.style.display = mode === 'done' ? 'block' : 'none';
  if (mode === 'items' || mode === 'review') renderItem();
  if (mode === 'sign') {
    requestAnimationFrame(() => {
      setupCanvas();
      clearCanvas();
    });
  }
}

function applyRecord(record) {
  state.record = record || null;
  const locked = !!(record && record.locked);
  if (locked) {
    el.lockedBanner.style.display = 'block';
    el.lockedBanner.textContent =
      '本案已於 ' +
      (record.signed_at || '') +
      ' 完成簽名並鎖定（版本 ' +
      (record.notice_version || '') +
      '）。';
    el.doneMeta.textContent =
      '簽名時間（台北）：' +
      (record.signed_at || '—') +
      '\n簽署人：' +
      (record.display_name || '—') +
      '\n內容版本：' +
      (record.notice_version || '—') +
      '\n內容雜湊：' +
      (record.notice_content_hash || '—');
    showMode('done');
  } else {
    el.lockedBanner.style.display = 'none';
  }
}

async function loadAll() {
  const res = await EsignNoticeApi.get(authBody());
  if (!res.success) throw new Error(res.message || '無法載入注意事項');
  state.notice = res.notice;
  state.noticeHash = res.notice_content_hash || '';
  el.versionBadge.textContent = '版本 ' + (res.notice_version || res.notice.version || '');
  el.heroSub.textContent =
    (res.notice.company || '') + '｜' + (res.notice.title || '簽約注意事項');
  applyRecord(res.record);
  if (!(res.record && res.record.locked) && !staffPreview) {
    try {
      const opened = await EsignNoticeApi.open(authBody());
      if (opened && opened.success && opened.record) {
        applyRecord(opened.record);
      }
    } catch (_) {}
  }
  if (!(state.record && state.record.locked)) {
    showMode('items');
  }
}

async function onAck() {
  if (state.busy) return;
  const item = currentItem();
  if (!item) return;
  const total = (state.notice.items || []).length;
  const locked = !!(state.record && state.record.locked);

  if (locked) {
    if (state.stepIndex >= total - 1) {
      showMode('done');
      return;
    }
    state.stepIndex += 1;
    renderItem();
    return;
  }

  if (staffPreview) {
    showMsg('內部預覽為唯讀，不會代客戶按「我了解」');
    if (state.stepIndex >= total - 1) {
      showMode('sign');
    } else {
      state.stepIndex += 1;
      renderItem();
    }
    return;
  }

  setBusy(true);
  showMsg('');
  try {
    const res = await EsignNoticeApi.ack(
      authBody({ item_id: item.id })
    );
    if (!res.success) throw new Error(res.message || '送出失敗');
    state.record = res.record;
    if (state.stepIndex >= total - 1) {
      showMode('sign');
    } else {
      state.stepIndex += 1;
      renderItem();
    }
  } catch (e) {
    showMsg(e.message || '送出失敗，請再試');
  } finally {
    setBusy(false);
  }
}

async function onSubmit() {
  if (state.busy) return;
  if (staffPreview) {
    showMsg('內部預覽不可代客戶簽名');
    return;
  }
  if (!hasInk) {
    showMsg('請先完成手寫簽名');
    return;
  }
  setBusy(true);
  showMsg('送出中…');
  try {
    const dataUrl = el.canvas.toDataURL('image/png');
    const res = await EsignNoticeApi.submit(
      authBody({
        signature_data_url: dataUrl,
        notice_content_hash: state.noticeHash,
      })
    );
    if (!res.success) throw new Error(res.message || '送出失敗');
    applyRecord(res.record);
    showMsg('已送出並鎖定', true);
  } catch (e) {
    showMsg(e.message || '送出失敗，請再試');
  } finally {
    setBusy(false);
  }
}

function buildPrintHtml(print) {
  const items = print.items || [];
  const ack = print.ack_times || {};
  const itemHtml = items
    .map((it) => {
      const t = ack[String(it.id)] || '—';
      return (
        '<div class="print-item"><strong>第 ' +
        it.id +
        ' 條' +
        (it.title ? '｜' + escapeHtml(it.title) : '') +
        '</strong><div>' +
        escapeHtml(it.body || '').replace(/\n/g, '<br/>') +
        '</div><div>我了解時間：' +
        escapeHtml(t) +
        '</div></div>'
      );
    })
    .join('');
  return (
    '<h2>' +
    escapeHtml(print.title || '簽約注意事項') +
    '</h2>' +
    '<div>' +
    escapeHtml(print.company || '') +
    '｜版本 ' +
    escapeHtml(print.notice_version || '') +
    '</div>' +
    '<div>內容雜湊：' +
    escapeHtml(print.notice_content_hash || '') +
    '</div>' +
    itemHtml +
    '<p><strong>' +
    escapeHtml(print.closing || '對於以上說明已經清楚了解。') +
    '</strong></p>' +
    '<p>立同意書人：' +
    escapeHtml(print.display_name || '') +
    '</p>' +
    '<p>簽名時間（台北）：' +
    escapeHtml(print.signed_at || '') +
    '</p>' +
    (print.signature_data_url
      ? '<img class="print-sig" src="' + print.signature_data_url + '" alt="簽名"/>'
      : '')
  );
}

async function onPrint() {
  if (state.busy) return;
  setBusy(true);
  showMsg('');
  try {
    const res = await EsignNoticeApi.print(authBody());
    if (!res.success) throw new Error(res.message || '無法取得列印資料');
    el.printArea.innerHTML = buildPrintHtml(res.print);
    el.printArea.style.display = 'block';
    window.print();
  } catch (e) {
    showMsg(e.message || '列印失敗');
  } finally {
    setBusy(false);
  }
}

function bindUi() {
  el.btnPrev.addEventListener('click', () => {
    if (state.stepIndex > 0) {
      state.stepIndex -= 1;
      showMode('items');
    }
  });
  el.btnAck.addEventListener('click', onAck);
  el.btnClearSign.addEventListener('click', clearCanvas);
  el.btnBackItems.addEventListener('click', () => {
    state.stepIndex = Math.max(0, ((state.notice.items || []).length || 1) - 1);
    showMode('items');
  });
  el.btnSubmit.addEventListener('click', onSubmit);
  el.btnPrint.addEventListener('click', onPrint);
  el.btnReview.addEventListener('click', () => {
    state.stepIndex = 0;
    showMode('review');
  });
}

async function boot() {
  bindUi();
  if (!projectNo) {
    el.boot.textContent = '網址缺少案號（project_no）。請向同仁索取正確連結。';
    return;
  }
  try {
    const session = await initLiffSession();
    if (!session) {
      el.boot.textContent = '正在導向登入…';
      return;
    }
    state.session = session;
    await loadAll();
    el.boot.style.display = 'none';
    el.app.style.display = 'block';
  } catch (e) {
    el.boot.textContent = e.message || '載入失敗';
  }
}

boot();

export const __test = {
  escapeHtml,
  buildPrintHtml,
  authBody,
  getState: () => state,
};
