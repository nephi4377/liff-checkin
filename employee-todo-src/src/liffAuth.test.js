import { describe, expect, it } from 'vitest';
import { ensureLiffSession } from './liffAuth.js';

describe('ensureLiffSession', () => {
  it('returns test token under vitest', async () => {
    const session = await ensureLiffSession();
    expect(session.loggedIn).toBe(true);
    expect(session.idToken).toBeTruthy();
  });
});
