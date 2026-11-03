import { afterEach, describe, expect, it } from 'vitest';
import {
  clearDocumentCache,
  documentCacheKey,
  readDocumentCache,
  writeDocumentCache,
} from './documentCache.js';

describe('documentCache', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('does not persist tasks to localStorage', () => {
    writeDocumentCache('assistant', {
      tasks: [{ id: '1', title: 'A' }],
      officeTasks: [],
      assigners: ['Nephi'],
      updatedAt: 99,
    });
    expect(readDocumentCache('assistant')).toBeNull();
    expect(localStorage.getItem(documentCacheKey('assistant'))).toBeNull();
  });

  it('clearDocumentCache removes legacy bridge key', () => {
    localStorage.setItem('employee-todo-sheet-bridge-v1', '{}');
    clearDocumentCache('assistant');
    expect(localStorage.getItem('employee-todo-sheet-bridge-v1')).toBeNull();
  });
});
