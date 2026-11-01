import { afterEach, describe, expect, it } from 'vitest';
import {
  documentCacheKey,
  readDocumentCache,
  writeDocumentCache,
} from './documentCache.js';

describe('documentCache', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('stores document per role without tokens', () => {
    writeDocumentCache('assistant', {
      tasks: [{ id: '1', title: 'A' }],
      officeTasks: [],
      assigners: ['Nephi'],
      updatedAt: 99,
    });
    const hit = readDocumentCache('assistant');
    expect(hit.tasks[0].title).toBe('A');
    expect(hit.assigners).toEqual(['Nephi']);
    expect(JSON.stringify(hit)).not.toMatch(/token/i);
    expect(documentCacheKey('assistant')).toContain('assistant');
  });

  it('returns null for missing role cache', () => {
    expect(readDocumentCache('ops-ende')).toBeNull();
  });
});
