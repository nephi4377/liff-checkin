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
      childNodes: [],
      appendChild(child) {
        this.childNodes.push(child);
        child.parentNode = this;
        return child;
      },
      querySelector(sel) {
        if (sel === '[data-rec-id]') return null;
        if (sel && sel.startsWith('#')) {
          const want = sel.slice(1);
          return this.childNodes.find((c) => c.id === want) || null;
        }
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
  const document = {
    createElement(tag) {
      const el = {
        tagName: String(tag).toUpperCase(),
        textContent: '',
        className: '',
        type: '',
        id: '',
        onclick: null,
        childNodes: [],
        appendChild(child) {
          this.childNodes.push(child);
          return child;
        }
      };
      return el;
    }
  };
  return { $, nodes, document };
}

test('humanReceiptFail and showReceiptLoadFail explain failure, not empty receipts', () => {
  const { $, document } = makeDom();
  const src = [
    extractFunctionBlock(html, 'humanReceiptFail'),
    extractFunctionBlock(html, 'showReceiptLoadFail')
  ].join('\n');
  const sandbox = vm.createContext({ $, document, showMsg: () => {}, loadData: () => {}, CustomerFinanceUi: undefined });
  vm.runInContext(src, sandbox);
  vm.runInContext('showReceiptLoadFail(new Error("x"), false);', sandbox);
  const rec = $('recList');
  const firstP = rec.childNodes[0];
  assert.equal(firstP.textContent, '收款紀錄暫時讀不到，請再試一次。這不代表沒有收款。');
  assert.equal(rec.childNodes.find((n) => n.id === 'btnRetryRec')?.textContent, '再試一次');
  assert.doesNotMatch(rec.innerHTML, /目前無待確認收款/);
  const human = vm.runInContext('humanReceiptFail(new Error("net"))', sandbox);
  assert.equal(human, '收款紀錄暫時讀不到，請再試一次。這不代表沒有收款。');
});

test('showReceiptLoadFail does not inject API error HTML into recList', () => {
  const { $, document } = makeDom();
  const src = [
    extractFunctionBlock(html, 'humanReceiptFail'),
    extractFunctionBlock(html, 'showReceiptLoadFail')
  ].join('\n');
  const sandbox = vm.createContext({ $, document, showMsg: () => {}, loadData: () => {} });
  vm.runInContext(src, sandbox);
  const evil = '<img src=x onerror="alert(1)">';
  vm.runInContext(`showReceiptLoadFail({ message: ${JSON.stringify(evil)} }, false);`, sandbox);
  const rec = $('recList');
  assert.equal(rec.childNodes[0].textContent, '收款紀錄暫時讀不到，請再試一次。這不代表沒有收款。');
  assert.doesNotMatch(rec.innerHTML, /<img|onerror|alert/);
});

test('loadData auto-retry: delay, busy state, then failure UI', async () => {
  const { $, document } = makeDom();
  $('projectSelect').value = '999';
  const busyLog = [];
  const retryDelays = [];
  const fetchAt = [];
  const loadDataSrc = extractFunctionBlock(html, 'loadData')
    .replace('async function loadData', 'async function loadDataFn')
    .replace(/\bloadData\(/g, 'loadDataFn(');
  const helpers = [
    extractFunctionBlock(html, 'humanReceiptFail'),
    extractFunctionBlock(html, 'showReceiptLoadFail').replace(/\bloadData\b/g, 'loadDataFn'),
    'var recLoadAutoTried_ = false;',
    'var portalMockMode = function () { return ""; };',
    'var staffPreview = false;',
    'var session = {};',
    'var SHOW_CUSTOMER_ADJUSTMENTS = false;',
    'function showMsg() {}',
    'function setContentBusy(on) { busyLog.push(!!on); }',
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
    document,
    setTimeout(fn, ms) {
      retryDelays.push(ms);
      return setTimeout(fn, ms);
    },
    busyLog,
    fetchAt,
    fetchCalls: 0,
    AccountingApi: {
      cfPortalData: async function () {
        sandbox.fetchAt.push(Date.now());
        sandbox.fetchCalls++;
        return { success: false, message: 'boom' };
      }
    },
    AccountingListCache: undefined
  });
  const t0 = Date.now();
  await vm.runInContext('(async function () {\n' + helpers + '\nawait run();\n})()', sandbox);
  assert.equal(sandbox.fetchCalls, 2, 'auto-retry once before showing fail UI');
  assert.equal(retryDelays[0], 1000, 'waits 1s before auto-retry');
  assert.ok(sandbox.fetchAt[1] - sandbox.fetchAt[0] >= 900, 'second fetch after ~1s delay');
  assert.ok(Date.now() - t0 >= 900);
  assert.ok(busyLog.indexOf(false) >= 2, 'busy not cleared until nested loadData finishes');
  assert.equal(busyLog.at(-1), false);
  const rec = $('recList');
  assert.equal(rec.childNodes[0].textContent, '收款紀錄暫時讀不到，請再試一次。這不代表沒有收款。');
  assert.doesNotMatch(rec.innerHTML, /目前無待確認收款/);
});

test('showReceiptBootFail is used for non-material boot errors', () => {
  const start = html.indexOf('    (async function boot() {');
  const end = html.indexOf('    })();', start) + '    })();'.length;
  const boot = html.slice(start, end);
  assert.match(boot, /showReceiptBootFail\(e\)/);
  assert.doesNotMatch(boot.slice(boot.indexOf('} catch (e)')), /loading.*textContent = e\.message/);
});
