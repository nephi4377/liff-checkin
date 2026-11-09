/**
 * 線上合約客戶頁（第一段：審閱寄出／首開／自願提前）
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

function renderContract(contract, caseFields) {
  const root = el('contractBody');
  if (!root || !contract) return;
  const fields = caseFields || {};
  const fill = (s) => String(s || '').replace(/\{\{(\w+)\}\}/g, (_, k) => (fields[k] != null && fields[k] !== '' ? fields[k] : '＿＿＿'));

  const parts = [];
  parts.push(`<p class="muted">版本 ${contract.version || ''} · 現行範本（5 處修正尚未套用）</p>`);
  parts.push(`<h2>${contract.title || '工程承攬契約書'}</h2>`);
  parts.push(`<pre class="preamble">${fill(contract.preamble)}</pre>`);
  (contract.articles || []).forEach((a) => {
    parts.push(`<section class="article"><h3>第${a.no}條　${a.title}</h3><div class="body">${fill(a.body).replace(/\n/g, '<br/>')}</div></section>`);
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
  ];
  box.textContent = lines.join('\n');
}

async function ensureAuth() {
  const projectNo = qs('project_no');
  if (!projectNo) throw new Error('連結缺少案號');

  if (isLocalHost() && qs('dev') === '1') {
    return {
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
  return {
    project_no: projectNo,
    uid: profile.userId,
    display_name: profile.displayName || '',
    liff_id_token: idToken || '',
    device_ua: navigator.userAgent || '',
  };
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
  el('hashMeta').textContent = `內容雜湊：${(data.contract_content_hash || '').slice(0, 12)}…`;

  if (!data.read_only) {
    try {
      const opened = await EsignContractApi.open(auth);
      if (opened.success) {
        renderReview(opened.record);
        data.record = opened.record;
      } else if (opened.message) {
        setStatus(opened.message, 'warn');
      }
    } catch (eOpen) {
      setStatus(eOpen.message || '記錄開啟時間失敗', 'warn');
    }
  }

  setStatus(data.read_only ? '唯讀（已鎖定或內部預覽）' : '可審閱', data.read_only ? 'ok' : '');

  const earlyBtn = el('btnEarly');
  const readyBtn = el('btnReady');
  const earlyCheck = el('earlyCheck');

  if (earlyBtn && earlyCheck) {
    earlyBtn.onclick = async () => {
      if (!earlyCheck.checked) {
        setStatus('請先勾選「已充分審閱，自願提前簽約」', 'warn');
        return;
      }
      earlyBtn.disabled = true;
      setStatus('處理中…', 'busy');
      try {
        const res = await EsignContractApi.ackEarly(
          Object.assign({}, auth, {
            voluntary_early_ack: true,
            contract_content_hash: data.contract_content_hash,
          })
        );
        if (!res.success) {
          setStatus(res.message || '勾選失敗', 'err');
          earlyBtn.disabled = false;
          return;
        }
        data.record = res.record;
        renderReview(res.record);
        setStatus('已記下自願提前', 'ok');
      } catch (e) {
        setStatus(e.message || '勾選失敗', 'err');
      }
      earlyBtn.disabled = false;
    };
  }

  if (readyBtn) {
    readyBtn.onclick = async () => {
      readyBtn.disabled = true;
      setStatus('處理中…', 'busy');
      try {
        const res = await EsignContractApi.ready(
          Object.assign({}, auth, {
            contract_content_hash: data.contract_content_hash,
          })
        );
        if (!res.success) {
          setStatus(res.message || '尚不可簽約', 'err');
          readyBtn.disabled = false;
          return;
        }
        data.record = res.record;
        renderReview(res.record);
        setStatus('審閱完成（已鎖定本步）。雙方簽名下一小段。', 'ok');
        earlyBtn && (earlyBtn.disabled = true);
        readyBtn.disabled = true;
        earlyCheck && (earlyCheck.disabled = true);
      } catch (e) {
        setStatus(e.message || '送出失敗', 'err');
        readyBtn.disabled = false;
      }
    };
  }
}

boot();
