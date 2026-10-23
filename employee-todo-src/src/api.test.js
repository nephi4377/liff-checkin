import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAuthPayload, postTodoAction } from './api.js';

describe('buildAuthPayload', () => {
  it('includes action and liff_id_token', () => {
    const body = buildAuthPayload('tok', 'todo_list');
    expect(body).toEqual({ action: 'todo_list', liff_id_token: 'tok' });
  });
});

describe('postTodoAction', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws on API failure message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 200,
        text: async () => JSON.stringify({ success: false, message: '權限不足' }),
      })),
    );
    await expect(postTodoAction({ action: 'todo_add' })).rejects.toThrow(/權限不足/);
  });
});
