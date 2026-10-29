import { describe, expect, it } from 'vitest';
import {
  buildEmployeeTodoAppUrl,
  EMPLOYEE_TODO_LIFF_ENDPOINT_URL,
} from './config.js';
import {
  buildEmployeeTodoLoginRedirectUri,
  isAllowedLiffRedirectUri,
} from './liffRedirectUri.js';

describe('buildEmployeeTodoLoginRedirectUri', () => {
  const endpoint = EMPLOYEE_TODO_LIFF_ENDPOINT_URL;

  it('builds paigong redirect on endpoint prefix', () => {
    expect(
      buildEmployeeTodoLoginRedirectUri({
        search: '?role=paigong&preview=1',
        href: `${endpoint}?role=paigong&preview=1`,
      }),
    ).toBe(`${endpoint}?role=paigong`);
  });

  it('builds ende redirect on endpoint prefix', () => {
    expect(
      buildEmployeeTodoLoginRedirectUri({
        search: '?role=ende',
        href: `${endpoint}?role=ende`,
      }),
    ).toBe(`${endpoint}?role=ende`);
  });

  it('omits preview from redirectUri', () => {
    const uri = buildEmployeeTodoLoginRedirectUri({
      search: '?role=paigong&preview=1',
      href: `${endpoint}?role=paigong&preview=1`,
    });
    expect(uri).not.toContain('preview');
  });

  it('rejects legacy employee-todo path if forced', () => {
    expect(
      isAllowedLiffRedirectUri(
        'https://info.tanxin.space/employee-todo/?role=paigong',
        endpoint,
      ),
    ).toBe(false);
  });
});

describe('isAllowedLiffRedirectUri (employee-todo LIFF endpoint)', () => {
  const endpoint = EMPLOYEE_TODO_LIFF_ENDPOINT_URL;

  it('accepts app root with role=paigong', () => {
    expect(
      isAllowedLiffRedirectUri(`${endpoint}?role=paigong`, endpoint),
    ).toBe(true);
  });

  it('rejects main console LIFF endpoint as redirect target', () => {
    expect(
      isAllowedLiffRedirectUri(
        'https://info.tanxin.space/modules/projects/managementconsole.html',
        endpoint,
      ),
    ).toBe(false);
  });
});

describe('buildEmployeeTodoAppUrl', () => {
  const endpoint = EMPLOYEE_TODO_LIFF_ENDPOINT_URL;

  it('matches allowed redirect targets for paigong and ende', () => {
    for (const role of ['paigong', 'ende']) {
      const url = buildEmployeeTodoAppUrl(role);
      expect(isAllowedLiffRedirectUri(url, endpoint)).toBe(true);
      expect(url).toContain(`role=${role}`);
    }
  });
});
