import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const html = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'quick_review.html'),
  'utf8'
);

async function retryOnce(fn) {
  try {
    return await fn();
  } catch (e1) {
    return await fn();
  }
}

test('page keeps fail copy distinct from empty list', () => {
  assert.match(html, /讀不到單據清單/);
  assert.match(html, /fetchListRetry/);
  assert.match(html, /renderFailList/);
  assert.match(html, /renderArchiveFail/);
  assert.match(html, /這不是「目前沒單據」/);
  assert.match(html, /這不是「還沒選廠商」/);
  assert.match(html, /此廠商目前沒有存檔紀錄/);
  assert.doesNotMatch(html, /showLoadFailedEmpty/);
  assert.doesNotMatch(html, /loadArchiveList\(\)\.catch\(function \(\) \{\}\)/);
});

test('retryOnce succeeds on the second try', async () => {
  var n = 0;
  var out = await retryOnce(async function () {
    n += 1;
    if (n === 1) throw new Error('fail');
    return { success: true, items: [1] };
  });
  assert.equal(out.success, true);
  assert.equal(n, 2);
});

test('retryOnce still throws if both tries fail', async () => {
  var n = 0;
  await assert.rejects(async function () {
    await retryOnce(async function () {
      n += 1;
      throw new Error('still down');
    });
  }, /still down/);
  assert.equal(n, 2);
});
