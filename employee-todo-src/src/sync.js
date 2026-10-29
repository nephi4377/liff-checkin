import { SYNC_INTERVAL_MS } from './config.js';

/**
 * 固定間隔同步（預設 45 秒）。背景分頁暫停輪詢，回到前景立即 refresh。
 * @param {(reason: 'interval'|'manual'|'visible') => void | Promise<void>} fn
 * @returns {() => void} cleanup
 */
export function startSyncLoop(fn, intervalMs = SYNC_INTERVAL_MS) {
  let stopped = false;
  let timer = null;

  const tick = async (reason) => {
    if (stopped) return;
    if (reason === 'interval' && document.hidden) return;
    try {
      await fn(reason);
    } catch (e) {
      console.warn('[employee-todo sync]', e);
    }
  };

  const clearTimer = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const scheduleInterval = () => {
    clearTimer();
    if (stopped || document.hidden) return;
    timer = setInterval(() => tick('interval'), intervalMs);
  };

  const onVisibilityChange = () => {
    if (document.hidden) {
      clearTimer();
      return;
    }
    tick('visible');
    scheduleInterval();
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  scheduleInterval();
  tick('manual');

  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisibilityChange);
    clearTimer();
  };
}
