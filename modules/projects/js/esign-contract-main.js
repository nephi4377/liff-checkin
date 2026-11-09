/**
 * 線上合約客戶／內部頁（審閱＋雙方簽名＋列印＋紙本）
 */
import { EsignContractApi } from './esign-contract-api.js';

const LIFF_ID = typeof ESIGN_CONTRACT_LIFF_ID !== 'undefined'
  ? ESIGN_CONTRACT_LIFF_ID
  : '2007974938-d2y1uA1G';

function qs(name) {
  return new URLSearchParams(location.search).get(name) || '';
}

function isLocalHost() {
  const h = location.hostname;
  return h === '127.0.0.1' || h === 'localhost';
}

function el(id) {
  return document.getElementById(id);
}

function setStatus(text, tone) {
  const box = el('statusLine');
  if (!box) return;
  box.textContent = text || '';
  box.dataset.tone = tone || '';
}

function show(id, on) {
  const node = el(id);
  if (!node) return;
  node.classList.toggle('hidden', !on);
}

function fillTemplate(s, fields) {
  return String(s || '').replace(/\{\{(\w+)\}\}/g, (_, k) =>
    fields[k] != null && fields[k] !== '' ? fields[k] : '＿＿＿'
  );
}

function renderContract(contract, caseFields) {
  const root = el('contractBody');
  if (!root || !contract) return;
  const fields = caseFields || {};
  const parts = [];
  parts.push(`<p class="muted">版本 ${contract.version || ''} · 現行範本（5 處修正尚未套用）</p>`);
  parts.push(`<h2>${contract.title || '工程承攬契約書'}</h2>`);
  parts.push(`<pre class="preamble">${fillTemplate(contract.preamble, fields)}</pre>`);
  (contract.articles || []).forEach((a) => {
    parts.push(
      `<section class="article"><h3>第${a.no}條　${a.title}</h3><div class="body">${fillTemplate(a.body, fields).replace(/\n/g, '<br/>')}</div></section>`
    );
  });
  root.innerHTML = parts.join('\n');
}

function renderReview(record) {
  const box = el('reviewBox');
  if (!box || !record) return;
  const lines = [
    `狀態：${record.status_label || record.status || '—'}`,
    `寄出：${record.sent_at || '尚未寄出'}`,
    `第一次打開：${record.first_opened_at || '尚未打開'}`,
    `審閱天數：${record.review_elapsed_days >= 0 ? record.review_elapsed_days : '—'}／${record.review_days || 7}`,
    `自願提前：${record.voluntary_early_ack ? '已勾（' + (record.voluntary_early_ack_at || '') + '）' : '未勾'}`,
    `甲方簽名：${record.party_a_signed ? (record.party_a_display_name || '已簽') + '　' + (record.party_a_signed_at || '') : '尚未'}`,
    `乙方簽名：${record.party_b_signed ? (record.party_b_display_name || '已簽') + '　' + (record.party_b_signed_at || '') : '尚未'}`,
    `紙本：${record.paper_opted ? '已選紙本（' + (record.paper_opted_at || '') + '）' : '可改紙本'}`,
  ];
  box.textContent = lines.join('\n');
}

function renderCaseSummary(record) {
  const box = el('caseSummary');
  const payBox = el('paySchedule');
  if (!record) return;
  const cf = record.case_fields || {};
  if (box) {
    box.textContent = [
      `案號：${cf.project_no || record.project_no || '—'}`,
      `案名：${cf.project_name || '—'}`,
      `地址：${cf.project_address || '—'}`,
      `甲方：${cf.party_a_name || '—'}　電話：${cf.party_a_phone || '—'}`,
      `開工：${cf.start_date || '—'}　工期：${cf.work_days || '—'} 天`,
      `總價：${cf.total_amount || '—'}`,
    ].join('\n');
  }
  if (payBox) {
    const rows = record.payment_schedule || [];
    if (!rows.length) {
      payBox.innerHTML = '<p class="muted">付款節點：預設載入中</p>';
      return;
    }
    const note = record.payment_schedule_custom ? '（本案自訂）' : '（預設 30/30/30/10）';
    payBox.innerHTML =
      `<p class="muted">付款節點${note}</p>` +
      '<table style="width:100%;border-collapse:collapse;font-size:0.9rem">' +
      rows
        .map((r, i) => {
          const amt = cf['payment_' + (i + 1) + '_amount'] || '—';
          return `<tr><td style="padding:4px 0;border-bottom:1px solid #d7dde6">第${r.stage}期 ${r.name}</td><td style="text-align:right;border-bottom:1px solid #d7dde6">${r.ratio}%　$${amt}</td></tr>`;
        })
        .join('') +
      '</table>';
  }
}

function makePad(canvas) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let dirty = false;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(180 * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1c2430';
    dirty = false;
  }

  function pos(ev) {
    const r = canvas.getBoundingClientRect();
    const t = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }

  function start(ev) {
    ev.preventDefault();
    drawing = true;
    const p = pos(ev);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function move(ev) {
    if (!drawing) return;
    ev.preventDefault();
    const p = pos(ev);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    dirty = true;
  }
  function end(ev) {
    if (!drawing) return;
    ev.preventDefault();
    drawing = false;
  }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', end);
  canvas.addEventListener('mouseleave', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);
  resize();
  window.addEventListener('resize', resize);

  return {
    clear() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dirty = false;
    },
    isDirty() {
      return dirty;
    },
    toDataUrl() {
      return canvas.toDataURL('image/png');
    },
  };
}

async function ensureAuth() {
  const projectNo = qs('project_no');
  if (!projectNo) throw new Error('連結缺少案號');
  const staffMode = qs('staff') === '1';

  if (isLocalHost() && qs('dev') === '1') {
    if (staffMode) {
      return {
        mode: 'staff',
        project_no: projectNo,
        userId: qs('uid') || 'Ustaffstaffstaffstaffstaffstaffst',
        display_name: '本機測試員工',
        device_ua: navigator.userAgent || '',
      };
    }
    return {
      mode: 'customer',
      project_no: projectNo,
      uid: qs('uid') || 'Uboundboundboundboundboundboundb',
      display_name: '本機測試客戶',
      device_ua: navigator.userAgent || '',
    };
  }

  if (!window.liff) throw new Error('請用 LINE 開啟');
  await liff.init({ liffId: LIFF_ID });
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: location.href });
    return null;
  }
  const profile = await liff.getProfile();
  const idToken = liff.getIDToken && liff.getIDToken();
  if (staffMode) {
    return {
      mode: 'staff',
      project_no: projectNo,
      userId: profile.userId,
      display_name: profile.displayName || '',
      liff_id_token: idToken || '',
      device_ua: navigator.userAgent || '',
    };
  }
  return {
    mode: 'customer',
    project_no: projectNo,
    uid: profile.userId,
    display_name: profile.displayName || '',
    liff_id_token: idToken || '',
    device_ua: navigator.userAgent || '',
  };
}

function buildPrintHtml(print) {
  const fields = print.case_fields || {};
  const arts = (print.articles || [])
    .map(
      (a) =>
        `<section><h3>第${a.no}條　${a.title}</h3><p>${fillTemplate(a.body, fields).replace(/\n/g, '<br/>')}</p></section>`
    )
    .join('');
  const sigA = print.party_a && print.party_a.signature_data_url
    ? `<img alt="甲方簽名" src="${print.party_a.signature_data_url}" style="max-width:280px;border:1px solid #ccc"/>`
    : '（尚未）';
  const sigB = print.party_b && print.party_b.signature_data_url
    ? `<img alt="乙方簽名" src="${print.party_b.signature_data_url}" style="max-width:280px;border:1px solid #ccc"/>`
    : '（尚未）';
  return `
    <h1>${print.title || '工程承攬契約書'}</h1>
    <p>版本 ${print.contract_version || ''}　狀態 ${print.status_label || ''}</p>
    <pre>${fillTemplate(print.preamble || '', fields)}</pre>
    ${arts}
    <h2>簽名</h2>
    <p>甲方：${(print.party_a && print.party_a.display_name) || ''}　${(print.party_a && print.party_a.signed_at) || ''}</p>
    ${sigA}
    <p>乙方：${(print.party_b && print.party_b.display_name) || ''}　${(print.party_b && print.party_b.signed_at) || ''}</p>
    ${sigB}
    <p>審閱：寄出 ${print.sent_at || '—'}；首開 ${print.first_opened_at || '—'}；自願提前 ${print.voluntary_early_ack ? print.voluntary_early_ack_at : '否'}</p>
    <p>${print.paper_option_note || ''}</p>
  `;
}

function syncUi(record, auth) {
  const locked = !!(record && record.locked);
  const paper = !!(record && record.paper_opted);
  const canA = !!(record && record.can_sign_party_a) && auth.mode === 'customer';
  const canB = !!(record && record.can_sign_party_b) && auth.mode === 'staff';
  const showReview = !locked && !paper && !(record && record.party_a_signed) && auth.mode === 'customer';
  show('reviewActions', showReview);
  show('signPartyA', canA);
  show('signPartyB', canB);
  const showAfter =
    paper ||
    (record && (record.party_a_signed || record.party_b_signed || record.status === 'signed'));
  show('afterSign', !!showAfter);
  if (el('doneMsg')) {
    if (paper) el('doneMsg').textContent = '已選改用紙本。請跟同事安排紙本簽約。';
    else if (record && record.status === 'signed')
      el('doneMsg').textContent = '雙方已簽名並鎖定。可回看或列印。';
    else if (record && record.party_a_signed)
      el('doneMsg').textContent = '甲方已簽，等待公司（乙方）簽名。您可先列印目前版本。';
    else el('doneMsg').textContent = '';
  }
  if (el('btnPaper2')) {
    el('btnPaper2').classList.toggle('hidden', locked || paper || (record && record.status === 'signed'));
  }
}

async function boot() {
  setStatus('更新中…', 'busy');
  let auth;
  try {
    auth = await ensureAuth();
    if (!auth) return;
  } catch (e) {
    setStatus(e.message || '無法驗證身分', 'err');
    return;
  }

  const padA = makePad(el('canvasA'));
  const padB = makePad(el('canvasB'));

  let data;
  try {
    data = await EsignContractApi.get(auth);
  } catch (e) {
    setStatus(e.message || '載入失敗', 'err');
    return;
  }
  if (!data.success) {
    setStatus(data.message || '無法開啟合約', 'err');
    return;
  }

  renderContract(data.contract, data.record && data.record.case_fields);
  renderReview(data.record);
  renderCaseSummary(data.record);
  el('hashMeta').textContent = `內容雜湊：${(data.contract_content_hash || '').slice(0, 12)}…`;

  if (auth.mode === 'customer' && !(data.record && data.record.locked)) {
    try {
      const opened = await EsignContractApi.open(auth);
      if (opened.success) {
        data.record = opened.record;
        renderReview(opened.record);
        renderCaseSummary(opened.record);
      }
    } catch (_) {}
  }

  syncUi(data.record, auth);
  setStatus(
    data.record && data.record.locked
      ? '已鎖定（可回看／列印）'
      : auth.mode === 'staff'
        ? '內部模式'
        : '可審閱／簽名',
    data.record && data.record.locked ? 'ok' : ''
  );

  async function refreshHashBody(extra) {
    return Object.assign({}, auth, {
      contract_content_hash: data.contract_content_hash,
      device_ua: auth.device_ua,
    }, extra || {});
  }

  el('btnEarly').onclick = async () => {
    if (!el('earlyCheck').checked) {
      setStatus('請先勾選「已充分審閱，自願提前簽約」', 'warn');
      return;
    }
    el('btnEarly').disabled = true;
    setStatus('處理中…', 'busy');
    try {
      const res = await EsignContractApi.ackEarly(
        await refreshHashBody({ voluntary_early_ack: true })
      );
      if (!res.success) {
        setStatus(res.message || '勾選失敗', 'err');
        el('btnEarly').disabled = false;
        return;
      }
      data.record = res.record;
      renderReview(res.record);
      syncUi(res.record, auth);
      setStatus('已記下自願提前', 'ok');
    } catch (e) {
      setStatus(e.message || '勾選失敗', 'err');
    }
    el('btnEarly').disabled = false;
  };

  el('btnReady').onclick = async () => {
    el('btnReady').disabled = true;
    setStatus('處理中…', 'busy');
    try {
      const res = await EsignContractApi.ready(await refreshHashBody());
      if (!res.success) {
        setStatus(res.message || '尚不可簽約', 'err');
        el('btnReady').disabled = false;
        return;
      }
      data.record = res.record;
      renderReview(res.record);
      syncUi(res.record, auth);
      setStatus('審閱完成，可簽名', 'ok');
    } catch (e) {
      setStatus(e.message || '送出失敗', 'err');
    }
    el('btnReady').disabled = false;
  };

  async function doPaper() {
    setStatus('處理中…', 'busy');
    try {
      const res = await EsignContractApi.paperOpt(auth);
      if (!res.success) {
        setStatus(res.message || '無法改紙本', 'err');
        return;
      }
      data.record = res.record;
      renderReview(res.record);
      syncUi(res.record, auth);
      setStatus('已記下改用紙本', 'ok');
    } catch (e) {
      setStatus(e.message || '無法改紙本', 'err');
    }
  }
  el('btnPaper').onclick = doPaper;
  el('btnPaper2').onclick = doPaper;

  el('btnClearA').onclick = () => padA && padA.clear();
  el('btnClearB').onclick = () => padB && padB.clear();

  el('btnSignA').onclick = async () => {
    if (!padA || !padA.isDirty()) {
      setStatus('請先完成手寫簽名', 'warn');
      return;
    }
    el('btnSignA').disabled = true;
    setStatus('送出簽名中…', 'busy');
    try {
      const res = await EsignContractApi.signPartyA(
        await refreshHashBody({ signature_data_url: padA.toDataUrl() })
      );
      if (!res.success) {
        setStatus(res.message || '簽名失敗', 'err');
        el('btnSignA').disabled = false;
        return;
      }
      data.record = res.record;
      renderReview(res.record);
      syncUi(res.record, auth);
      setStatus('甲方已簽名', 'ok');
    } catch (e) {
      setStatus(e.message || '簽名失敗', 'err');
      el('btnSignA').disabled = false;
    }
  };

  el('btnSignB').onclick = async () => {
    if (!padB || !padB.isDirty()) {
      setStatus('請先完成手寫簽名', 'warn');
      return;
    }
    el('btnSignB').disabled = true;
    setStatus('送出簽名中…', 'busy');
    try {
      const res = await EsignContractApi.signPartyB(
        await refreshHashBody({ signature_data_url: padB.toDataUrl() })
      );
      if (!res.success) {
        setStatus(res.message || '簽名失敗', 'err');
        el('btnSignB').disabled = false;
        return;
      }
      data.record = res.record;
      renderReview(res.record);
      syncUi(res.record, auth);
      setStatus('雙方已簽並鎖定', 'ok');
    } catch (e) {
      setStatus(e.message || '簽名失敗', 'err');
      el('btnSignB').disabled = false;
    }
  };

  el('btnPrint').onclick = async () => {
    setStatus('準備列印…', 'busy');
    try {
      const res = await EsignContractApi.print(auth);
      if (!res.success) {
        setStatus(res.message || '無法列印', 'err');
        return;
      }
      el('printArea').innerHTML = buildPrintHtml(res.print);
      setStatus('可列印', 'ok');
      window.print();
    } catch (e) {
      setStatus(e.message || '無法列印', 'err');
    }
  };
}

boot();
