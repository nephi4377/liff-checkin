import { EMPLOYEE_TODO_LIFF_ENDPOINT_URL } from './config.js';

/**
 * LINE：redirectUri 必須以 Endpoint URL 字串為前綴（query／hash 不影響是否符合前綴）。
 */
export function isAllowedLiffRedirectUri(
  redirectUri,
  endpointUrl = EMPLOYEE_TODO_LIFF_ENDPOINT_URL,
) {
  if (!redirectUri || !endpointUrl) return false;
  const stripHash = (s) => s.split('#')[0];
  return stripHash(redirectUri).startsWith(stripHash(endpointUrl));
}

/** @deprecated prefer buildEmployeeTodoLoginRedirectUri */
export function buildLoginRedirectUri(loc = window.location) {
  return loc.href.split('#')[0];
}

/**
 * 登入後回到 Endpoint 下的 app URL，保留 ?role=（不帶 preview 等測試參數）。
 */
export function buildEmployeeTodoLoginRedirectUri(loc = window.location) {
  const u = new URL(EMPLOYEE_TODO_LIFF_ENDPOINT_URL);
  const role = new URLSearchParams(loc.search || '').get('role');
  if (role) u.searchParams.set('role', role);
  const redirectUri = u.href.split('#')[0];
  return assertAllowedLoginRedirectUri(redirectUri);
}

export function assertAllowedLoginRedirectUri(
  redirectUri,
  endpointUrl = EMPLOYEE_TODO_LIFF_ENDPOINT_URL,
) {
  if (!isAllowedLiffRedirectUri(redirectUri, endpointUrl)) {
    throw new Error(
      'LIFF redirectUri 不在 Endpoint 前綴內：' +
        `${redirectUri}（需以 ${endpointUrl} 開頭）`,
    );
  }
  return redirectUri;
}
