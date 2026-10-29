import { describe, expect, it } from 'vitest';
import {
  buildEmployeeTodoAppUrl,
  EMPLOYEE_TODO_LIFF_ENDPOINT_URL,
} from './config.js';
import {
  assertAllowedLoginRedirectUri,
  buildLoginRedirectUri,
  isAllowedLiffRedirectUri,
} from './liffRedirectUri.js';

describe('isAllowedLiffRedirectUri (employee-todo LIFF endpoint)', () => {
  const endpoint = EMPLOYEE_TODO_LIFF_ENDPOINT_URL;

  it('accepts app root with role=paigong', () => {
    expect(
      isAllowedLiffRedirectUri(`${endpoint}?role=paigong`, endpoint),
    ).toBe(true);
  });

  it('accepts app root with role=ende', () => {
    expect(isAllowedLiffRedirectUri(`${endpoint}?role=ende`, endpoint)).toBe(
      true,
    );
  });

  it('rejects legacy /employee-todo/', () => {
    expect(
      isAllowedLiffRedirectUri(
        'https://info.tanxin.space/employee-todo/?role=paigong',
        endpoint,
      ),
    ).toBe(false);
  });

  it('rejects main console LIFF endpoint as redirect target', () => {
    expect(
      isAllowedLiffRedirectUri(
        'https://info.tanxin.space/modules/projects/managementconsole.html?employeeTodo=1',
        endpoint,
      ),
    ).toBe(false);
  });

  it('buildLoginRedirectUri keeps role query for liff.login', () => {
    const loc = {
      href: `${endpoint}?role=ende`,
      search: '?role=ende',
    };
    expect(buildLoginRedirectUri(loc)).toBe(`${endpoint}?role=ende`);
    expect(() =>
      assertAllowedLoginRedirectUri(buildLoginRedirectUri(loc), endpoint),
    ).not.toThrow();
  });

  it('buildEmployeeTodoAppUrl matches allowed redirect targets', () => {
    for (const role of ['paigong', 'ende']) {
      const url = buildEmployeeTodoAppUrl(role);
      expect(isAllowedLiffRedirectUri(url, endpoint)).toBe(true);
      expect(url).toContain(`role=${role}`);
    }
  });
});
