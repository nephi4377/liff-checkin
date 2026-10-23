import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..', '..');
const TOOLS_DIR = path.join(REPO_ROOT, 'tools');

describe('tools CommonJS compat (main package.json, no type module)', () => {
    it('package.json 存在且不含 type:module', () => {
        const pkgPath = path.join(TOOLS_DIR, 'package.json');
        expect(fs.existsSync(pkgPath)).toBe(true);
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        expect(pkg.type).toBeUndefined();
        expect(pkg.devDependencies?.xlsx).toBeTruthy();
    });

    it('從 .mjs 以 createRequire 載入 budget-quote-parser-lib.js 取得解析函式', () => {
        const require = createRequire(path.join(TOOLS_DIR, 'test_budget_parse_778.mjs'));
        const parser = require('./budget-quote-parser-lib.js');
        expect(parser).toBeTruthy();
        expect(Object.keys(parser).length).toBeGreaterThan(10);
        expect(typeof parser.assignUniqueItemIdForSheet).toBe('function');
        expect(typeof parser.stableItemContentHash).toBe('function');
    });

    it('tools/ 目錄 npm ci 後可 require(xlsx)', async () => {
        await execFileAsync('npm', ['ci'], { cwd: TOOLS_DIR, env: process.env });
        const require = createRequire(path.join(TOOLS_DIR, 'package.json'));
        const xlsx = require('xlsx');
        expect(xlsx).toBeTruthy();
        expect(typeof xlsx.read).toBe('function');
    }, 120000);
});
