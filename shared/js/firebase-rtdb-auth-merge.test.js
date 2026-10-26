import { describe, expect, it } from 'vitest';
import {
  buildFirebaseWebInitOptions,
  firebaseWebAuthReady,
  mergeFbAuditConfig,
} from './firebase-rtdb-auth-merge.js';

const PUB = {
  apiKey: 'test-key',
  authDomain: 'test.firebaseapp.com',
  databaseURL: 'https://test.firebaseio.com',
  projectId: 'test-proj',
};

describe('mergeFbAuditConfig', () => {
  it('uses public defaults when localStorage auth fields empty', () => {
    const m = mergeFbAuditConfig({}, PUB, {});
    expect(m.apiKey).toBe('test-key');
    expect(m.authDomain).toBe('test.firebaseapp.com');
    expect(m.projectId).toBe('test-proj');
    expect(firebaseWebAuthReady(m)).toBe(true);
  });

  it('localStorage overrides public defaults', () => {
    const m = mergeFbAuditConfig({ apiKey: 'custom' }, PUB, {});
    expect(m.apiKey).toBe('custom');
    expect(m.authDomain).toBe('test.firebaseapp.com');
  });

  it('buildFirebaseWebInitOptions includes auth when ready', () => {
    const m = mergeFbAuditConfig({}, PUB, {});
    const o = buildFirebaseWebInitOptions(m);
    expect(o.databaseURL).toBe(PUB.databaseURL);
    expect(o.apiKey).toBe(PUB.apiKey);
  });
});
