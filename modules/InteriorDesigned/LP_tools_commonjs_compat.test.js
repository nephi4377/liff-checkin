import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..', '..');
const TOOLS_DIR = path.join(REPO_ROOT, 'tools');

describe('tools CommonJS compat (no tools/package.json type module)', () => {
    it('從 .mjs 以 createRequire 載入 budget-quote-parser-lib.js 取得解析函式', () => {
        expect(fs.existsSync(path.join(TOOLS_DIR, 'package.json'))).toBe(false);
        const require = createRequire(path.join(TOOLS_DIR, 'test_budget_parse_778.mjs'));
        const parser = require('./budget-quote-parser-lib.js');
        expect(parser).toBeTruthy();
        expect(Object.keys(parser).length).toBeGreaterThan(10);
        expect(typeof parser.assignUniqueItemIdForSheet).toBe('function');
        expect(typeof parser.stableItemContentHash).toBe('function');
    });
});
