import { describe, expect, it } from 'vitest';
import {
  EMPLOYEE_TODO_LIFF_ID,
  resolveEmployeeTodoLiffId,
} from './config.js';

describe('EMPLOYEE_TODO_LIFF_ID', () => {
  it('is configured for dedicated LIFF app', () => {
    expect(EMPLOYEE_TODO_LIFF_ID).toBe('2007974938-U374uwei');
    expect(resolveEmployeeTodoLiffId()).toBe('2007974938-U374uwei');
  });
});
