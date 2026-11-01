/** 等待 defer 載入的 LIFF SDK（不阻塞首屏 React） */
export function waitForLiffSdk(timeoutMs = 20_000) {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.liff) return Promise.resolve(window.liff);
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const id = setInterval(() => {
      if (window.liff) {
        clearInterval(id);
        resolve(window.liff);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        clearInterval(id);
        reject(new Error('LIFF SDK 載入逾時'));
      }
    }, 40);
  });
}
