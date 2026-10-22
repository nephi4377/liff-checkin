/**
 * Customer portal: receipt load / boot failures must not look like empty list.
 * Run: node --test tools/test-customer-portal-receipt-fail.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../modules/accounting/customer-finance-portal.html', import.meta.url), 'utf8');

function extractBalancedBraceBlock(source, openBraceIndex) {
  let depth = 0;
  for (let i = openBraceIndex; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(openBraceIndex, i + 1);
    }
  }
  throw new Error('unbalanced braces');
}

function extractFunctionBlock(source, name) {
  const asyncMarker = `async function ${name}`;
  const plainMarker = `function ${name}`;
  let start = source.indexOf(asyncMarker);
  if (start >= 0) {
    const brace = source.indexOf('{', start);
    const body = extractBalancedBraceBlock(source, brace);
    return source.slice(start, brace) + body;
  }
  start = source.indexOf(plainMarker);
  if (start < 0) throw new Error('missing ' + name);
  const brace = source.indexOf('{', start);
  const body = extractBalancedBraceBlock(source, brace);
  return source.slice(start, brace) + body;
}

function makeDom() {
  const nodes = new Map();
  const makeEl = (id) => {
    const el = {
      id,
      innerHTML: id === 'recList' ? '—' : '',
      textContent: '',
      disabled: false,
      value: '999',
      classList: { add() {}, remove() {}, toggle() {} },
      style: {},
      querySelector(sel) {
        if (sel === '[data-rec-id]') return null;
        return null;
      },
      querySelectorAll() { return []; }
    };
    return el;
  };
  const $ = (id) => {
    if (!nodes.has(id)) nodes.set(id, makeEl(id));
    return nodes.get(id);
  };
  return { $, nodes };
}

test('humanReceiptFail and showReceiptLoadFail explain failure, not empty receipts', () => {
  const { $ } = makeDom();
  const src = [
    extractFunctionBlock(html, 'humanReceiptFail'),
    extractFunctionBlock(html, 'showReceiptLoadFail')
  ].join('\n');
  const sandbox = vm.createContext({ $, showMsg: () => {}, loadData: () => {}, CustomerFinanceUi: undefined });
  vm.runInContext(src, sandbox);
  vm.runInContext('showReceiptLoadFail(new Error("x"), false);', sandbox);
  const recHtml = $('recList').innerHTML;
  assert.match(recHtml, /這不代表沒有收款/);
  assert.match(recHtml, /再試一次/);
  assert.doesNotMatch(recHtml, /目前無待確認收款/);
  const human = vm.runInContext('humanReceiptFail(new Error("net"))', sandbox);
  assert.equal(human, '收款紀錄暫時讀不到，請再試一次。這不代表沒有收款。');
});

test('loadData after auto-retry shows failure UI on persistent API fail', async () => {
  const { $ } = makeDom();
  const projectSelect = $('projectSelect');
  projectSelect.value = '999';
  const content = $('content');
  content.classList = { _c: new Set(), add(k) { this._c.add(k); }, remove(k) { this._c.delete(k); }, toggle(k, on) { on ? this._c.add(k) : this._c.delete(k); } };

  const loadDataSrc = extractFunctionBlock(html, 'loadData').replace('async function loadData', 'async function loadDataFn').replace('return loadData(true)', 'return loadDataFn(true)').replace('loadData(true)', 'loadDataFn(true)');
  const helpers = [
    extractFunctionBlock(html, 'humanReceiptFail'),
    extractFunctionBlock(html, 'showReceiptLoadFail').replace(/\bloadData\b/g, 'loadDataFn'),
    'var recLoadAutoTried_ = false;',
    'var portalMockMode = function () { return ""; };',
    'var staffPreview = false;',
    'var session = {};',
    'var SHOW_CUSTOMER_ADJUSTMENTS = false;',
    'function showMsg() {}',
    'function setContentBusy() {}',
    'function renderAdj() {}',
    'function renderRec(items) {',
    '  $("recList").innerHTML = items.length ? "<div data-rec-id=\\"1\\"></div>" : "<p>目前無待確認收款</p>";',
    '}',
    'function focusDeepLinkEntity() {}',
    loadDataSrc,
    'async function run() { await loadDataFn(false); }'
  ].join('\n');

  const sandbox = vm.createContext({
    $,
    fetchCalls: 0,
    AccountingApi: {
      cfPortalData: async function () {
        sandbox.fetchCalls++;
        return { success: false, message: 'boom' };
      }
    },
    AccountingListCache: undefined
  });
  await vm.runInContext('(async function () {\n' + helpers + '\nawait run();\n})()', sandbox);
  assert.equal(sandbox.fetchCalls, 2, 'auto-retry once before showing fail UI');
  assert.match($('recList').innerHTML, /這不代表沒有收款/);
  assert.doesNotMatch($('recList').innerHTML, /目前無待確認收款/);
});

test('showReceiptBootFail is used for non-material boot errors', () => {
  const start = html.indexOf('    (async function boot() {');
  const end = html.indexOf('    })();', start) + '    })();'.length;
  const boot = html.slice(start, end);
  assert.match(boot, /showReceiptBootFail\(e\)/);
  assert.doesNotMatch(boot.slice(boot.indexOf('} catch (e)')), /loading.*textContent = e\.message/);
});
