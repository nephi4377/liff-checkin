import { describe, expect, it } from 'vitest';
import { isEmployeeTodoPreviewMode, isLocalhost } from './localDev.js';

describe('localDev', () => {
  it('detects localhost hostnames', () => {
    expect(isLocalhost('localhost')).toBe(true);
    expect(isLocalhost('127.0.0.1')).toBe(true);
    expect(isLocalhost('info.tanxin.space')).toBe(false);
  });

  it('preview only on localhost', () => {
    expect(isEmployeeTodoPreviewMode('?preview=1', 'localhost')).toBe(true);
    expect(isEmployeeTodoPreviewMode('?preview=1', 'info.tanxin.space')).toBe(false);
    expect(isEmployeeTodoPreviewMode('?demo=1', '127.0.0.1')).toBe(true);
  });
});
