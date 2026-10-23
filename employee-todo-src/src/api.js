import { GAS_WEB_APP_URL } from './config.js';

export async function postTodoAction(body) {
  const res = await fetch(GAS_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`API 回應非 JSON（HTTP ${res.status}）`);
  }
  if (!data || data.success === false) {
    const msg = (data && data.message) || `API 失敗（HTTP ${res.status}）`;
    throw new Error(msg);
  }
  return data;
}

export function buildAuthPayload(liffIdToken, action, extra = {}) {
  return {
    action,
    liff_id_token: liffIdToken,
    ...extra,
  };
}
