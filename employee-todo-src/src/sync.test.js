import { afterEach, describe, expect, it, vi } from 'vitest';
import { SYNC_INTERVAL_MS } from './config.js';
import { startSyncLoop } from './sync.js';

describe('startSyncLoop', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses 45 second default interval', () => {
    expect(SYNC_INTERVAL_MS).toBe(45_000);
  });

  it('calls sync on start and on interval', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const stop = startSyncLoop(fn, 1000);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0]).toBe('manual');
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls[1][0]).toBe('interval');
    stop();
    vi.advanceTimersByTime(5000);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('pauses while hidden and refreshes when visible', async () => {
    vi.useFakeTimers();
    let hidden = false;
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    });
    const fn = vi.fn();
    const stop = startSyncLoop(fn, 1000);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(2);
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(5000);
    expect(fn).toHaveBeenCalledTimes(2);
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn.mock.calls[2][0]).toBe('visible');
    stop();
  });
});
