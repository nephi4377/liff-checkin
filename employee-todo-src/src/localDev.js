/**
 * 本機開發／預覽：正式站（info.tanxin.space 等）不可靠 query 略過 LINE 登入。
 */
export function isLocalhost(hostname) {
  const h =
    hostname != null
      ? String(hostname)
      : typeof globalThis.location !== 'undefined'
        ? globalThis.location.hostname
        : '';
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

export function isEmployeeTodoPreviewMode(search, hostname) {
  if (!isLocalhost(hostname)) return false;
  const q = new URLSearchParams(
    search != null ? search : globalThis.location?.search || '',
  );
  return q.get('preview') === '1' || q.get('demo') === '1';
}
