/**
 * 線上合約 API（走 project-console GAS）— ESIGN-CONTRACT-2
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

export const EsignContractApi = {
  get(authBody) {
    return postAction('esign_contract_get', authBody);
  },
  staffSend(authBody) {
    return postAction('esign_contract_staff_send', authBody);
  },
  open(authBody) {
    return postAction('esign_contract_open', authBody);
  },
  ackEarly(authBody) {
    return postAction('esign_contract_ack_early', authBody);
  },
  ready(authBody) {
    return postAction('esign_contract_ready', authBody);
  },
  signPartyA(authBody) {
    return postAction('esign_contract_sign_party_a', authBody);
  },
  signPartyB(authBody) {
    return postAction('esign_contract_sign_party_b', authBody);
  },
  paperOpt(authBody) {
    return postAction('esign_contract_paper_opt', authBody);
  },
  print(authBody) {
    return postAction('esign_contract_print', authBody);
  },
  status(authBody) {
    return postAction('esign_contract_status', authBody);
  },
};
