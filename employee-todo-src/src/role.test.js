import { describe, expect, it } from 'vitest';
import { resolveRoleFromLocation, roleLabel } from './role.js';

describe('resolveRoleFromLocation', () => {
  it('maps paigong query to assistant', () => {
    expect(resolveRoleFromLocation({ pathname: '/employee-todo/', search: '?role=paigong' })).toBe('assistant');
  });

  it('maps ende to ops-ende', () => {
    expect(resolveRoleFromLocation({ pathname: '/ende', search: '' })).toBe('ops-ende');
  });

  it('defaults to hub', () => {
    expect(resolveRoleFromLocation({ pathname: '/', search: '' })).toBe('hub');
  });
});

describe('roleLabel', () => {
  it('labels assistant as 派工', () => {
    expect(roleLabel('assistant')).toBe('派工');
  });
});
