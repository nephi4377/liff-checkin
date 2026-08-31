import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, 'app.js'), 'utf8');
const m = src.match(/function describeBatchFinish\(okCount, failCount\) \{[\s\S]*?\n  \}/);
assert.ok(m, 'describeBatchFinish 應存在於 app.js');
const ctx = createContext({});
const fn = runInNewContext(m[0] + '\ndescribeBatchFinish;', ctx);

assert.equal(fn(3, 0).type, 'ok');
assert.match(fn(3, 0).text, /共 3 張/);

const allFail = fn(0, 2);
assert.equal(allFail.type, 'error');
assert.match(allFail.text, /全部失敗/);
assert.doesNotMatch(allFail.text, /結束/);

const mixed = fn(2, 1);
assert.equal(mixed.type, 'error');
assert.match(mixed.text, /完成 2 張/);
assert.match(mixed.text, /失敗 1 張/);

assert.match(src, /function pingStudio\(/);
assert.match(src, /btnBootRetry/);
assert.match(src, /apiPostWithTimeout/);
assert.doesNotMatch(src, /setStatus\('批次渲染結束', 'ok'\)/);

console.log('batch-finish.test.mjs ok');
