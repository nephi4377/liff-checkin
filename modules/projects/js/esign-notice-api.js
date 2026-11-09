/**
 * 簽約注意事項 API（走 project-console GAS）
 */
import { CONFIG } from '/shared/js/config.js';

function gasUrl() {
  return String(CONFIG.GAS_WEB_APP_URL || '').trim();
}

async function postAction(action, body) {
  const url = gasUrl();
  if (!url) throw new Error('尚未設定後端網址');
  const payload = Object.assign({ action: action }, body || {});
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow',
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('後端回應格式異常');
  }
  return data;
}

export const EsignNoticeApi = {
  get(authBody) {
    return postAction('esign_notice_get', authBody);
  },
  open(authBody) {
    return postAction('esign_notice_open', authBody);
  },
  ack(authBody) {
    return postAction('esign_notice_ack', authBody);
  },
  submit(authBody) {
    return postAction('esign_notice_submit', authBody);
  },
  status(authBody) {
    return postAction('esign_notice_status', authBody);
  },
  print(authBody) {
    return postAction('esign_notice_print', authBody);
  },
};
