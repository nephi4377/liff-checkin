import { SYNC_INTERVAL_MS } from './config.js';

/**
 * 註冊固定間隔同步（預設 12 秒，與舊版一致）
 * @param {(reason: 'interval'|'manual') => void | Promise<void>} fn
 * @returns {() => void} cleanup
 */
export function startSyncLoop(fn, intervalMs = SYNC_INTERVAL_MS) {
  let stopped = false;
  let timer = null;

  const tick = async (reason) => {
    if (stopped) return;
    try {
      await fn(reason);
    } catch (e) {
      console.warn('[employee-todo sync]', e);
    }
  };

  timer = setInterval(() => tick('interval'), intervalMs);
  tick('manual');

  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
  };
}
