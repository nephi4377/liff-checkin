/**
 * Hub：報價解析器下方之「報價編輯」連結與 #/quote-editor 路由
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appJs = readFileSync(join(root, 'spa/app.js'), 'utf8');
const dashJs = readFileSync(join(root, 'spa/Dashboard.js'), 'utf8');

test('app.js registers quote-editor iframe route with cache bust', () => {
  assert.match(appJs, /'#\/quote-editor':\s*\{[^}]*quote-editor\.html\?v=quote-sheet-2/);
});

test('Dashboard stacks quote editor card directly under budget parser', () => {
  const blockStart = dashJs.indexOf('<!-- 4. 報價單解析器');
  assert.ok(blockStart > 0, 'parser block comment missing');
  const block = dashJs.slice(blockStart, blockStart + 2800);
  const parserIdx = block.indexOf('報價單解析器');
  const editorIdx = block.indexOf('>報價編輯<');
  assert.ok(parserIdx >= 0 && editorIdx > parserIdx, 'quote editor appears after parser in card block');
  assert.match(dashJs, /md:col-span-2 flex flex-col gap-3/);
  assert.match(dashJs, /openQuoteEditor/);
  assert.match(dashJs, /QUOTE_EDITOR_ROLLOUT_PROJECT = '999'/);
  assert.match(dashJs, /quoteEditorCardVisible/);
  assert.match(dashJs, /#\/quote-editor\?project_no=/);
});
