/**
 * Accounting ingest: LINE pending photos load failure must not look like "0 photos".
 * Run: node --test tools/test-accounting-ingest-pending-photos-fail.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../modules/accounting/accounting_ingest.html', import.meta.url), 'utf8');

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
      innerHTML: '',
      textContent: id === 'photoCountLine' ? '已 0 張' : '',
      className: '',
      classList: {
        _hidden: id === 'pendingPhotoError',
        add(c) { if (c === 'hidden') this._hidden = true; },
        remove(c) { if (c === 'hidden') this._hidden = false; },
        toggle() {}
      },
      style: {},
      childNodes: [],
      appendChild(child) {
        this.childNodes.push(child);
        child.parentNode = this;
        if (child.tagName === 'BUTTON') this._retryBtn = child;
        return child;
      }
    };
    Object.defineProperty(el.classList, 'contains', {
      value: (c) => (c === 'hidden' ? el.classList._hidden : false)
    });
    return el;
  };
  const $ = (id) => {
    if (!nodes.has(id)) nodes.set(id, makeEl(id));
    return nodes.get(id);
  };
  const document = {
    createElement(tag) {
      return {
        tagName: String(tag).toUpperCase(),
        textContent: '',
        className: '',
        type: '',
        style: {},
        addEventListener() {},
        appendChild() {}
      };
    },
    getElementById(id) { return $(id); }
  };
  return { document, $, nodes };
}

function bootSubmitFlow(extra) {
  const { document, $ } = makeDom();
  const pendingPhotos = [];
  const localPhotos = [];
  let pendingPhotoBusy = false;
  let pendingPhotosLoadedOk = false;
  let pendingPhotoLoadGen = 0;
  let pendingPhotoLoadPromise = null;
  let submitting = false;
  const queryParams = extra.queryParams || { pending: 'tok1' };
  const profile = { userId: 'u1', displayName: 'Test' };
  let askSubmitAnswer = extra.askSubmitAnswer !== undefined ? extra.askSubmitAnswer : true;
  let btnBusyLabel = '';

  const snippet = [
    'function invalidatePendingPhotoLoads() { pendingPhotoLoadGen++; }',
    extractFunctionBlock(html, 'humanLineCarryErr'),
    extractFunctionBlock(html, 'showLineCarryError'),
    extractFunctionBlock(html, 'clearLineCarryError'),
    extractFunctionBlock(html, 'applyIncomingPendingPhotos'),
    extractFunctionBlock(html, 'fetchPendingPhotosOnce'),
    extractFunctionBlock(html, 'fetchPendingPhotosRetry'),
    extractFunctionBlock(html, 'loadPendingPhotos'),
    extractFunctionBlock(html, 'pendingLinePhotoCarryFailed'),
    extractFunctionBlock(html, 'releaseIngestSubmit'),
    'function askDupConfirm(msg) { return Promise.resolve(askSubmitAnswer); }',
    extractFunctionBlock(html, 'askSubmitWithoutLinePhotos'),
    extractFunctionBlock(html, 'ingestSubmitPhotoGate'),
    'function showPendingPreviews() {}',
    'function updatePhotoCountLine() {',
    '  var n = pendingPhotos.length + localPhotos.length;',
    '  document.getElementById("photoCountLine").textContent = "已 " + n + " 張";',
    '}',
    'function attachIngestAuth(body) { body.user_id = profile.userId; }',
    'async function simulateIngestSubmit() {',
    '  if (submitting) return;',
    '  submitting = true;',
    '  var btn = document.getElementById("submit");',
    '  try {',
    '    var proceed = await ingestSubmitPhotoGate(btn);',
    '    if (!proceed) return;',
    '    await AccountingUi.runAsync(btn, {}, async function () {',
    '      await AccountingApi.post({ action: "accounting_form_submit", user_id: profile.userId });',
    '    });',
    '  } finally {',
    '    releaseIngestSubmit(btn);',
    '  }',
    '}'
  ].join('\n');

  const AccountingUi = {
    setBtnBusy(btn, on, label) {
      if (on) btnBusyLabel = label || '';
      else btnBusyLabel = '';
    },
    runAsync: extra.runAsync || (async (btn, _opts, fn) => fn())
  };

  const sandbox = {
    document,
    profile,
    queryParams,
    pendingPhotos,
    localPhotos,
    pendingPhotoBusy,
    pendingPhotosLoadedOk,
    pendingPhotoLoadGen,
    pendingPhotoLoadPromise,
    submitting,
    askSubmitAnswer,
    AccountingApi: extra.AccountingApi,
    AccountingUi
  };
  vm.createContext(sandbox);
  vm.runInContext(snippet, sandbox);
  return { sandbox, $, getBtnBusyLabel: () => btnBusyLabel };
}

function bootIngestApi(extra) {
  const { document, $ } = makeDom();
  const pendingPhotos = [];
  const localPhotos = [];
  let pendingPhotoBusy = false;
  let pendingPhotosLoadedOk = false;
  let pendingPhotoLoadGen = 0;
  let pendingPhotoLoadPromise = null;
  const profile = { userId: 'u1', displayName: 'Test' };

  const snippet = [
    'function invalidatePendingPhotoLoads() { pendingPhotoLoadGen++; }',
    extractFunctionBlock(html, 'humanLineCarryErr'),
    extractFunctionBlock(html, 'showLineCarryError'),
    extractFunctionBlock(html, 'clearLineCarryError'),
    extractFunctionBlock(html, 'applyIncomingPendingPhotos'),
    extractFunctionBlock(html, 'fetchPendingPhotosOnce'),
    extractFunctionBlock(html, 'fetchPendingPhotosRetry'),
    extractFunctionBlock(html, 'loadPendingPhotos'),
    'function setMsg() {}',
    'function showPendingPreviews() {}',
    'function updatePhotoCountLine() {',
    '  var n = pendingPhotos.length + localPhotos.length;',
    '  document.getElementById("photoCountLine").textContent = "已 " + n + " 張";',
    '}',
    'function attachIngestAuth(body) { body.user_id = profile.userId; }'
  ].join('\n');

  const sandbox = {
    document,
    profile,
    pendingPhotos,
    localPhotos,
    pendingPhotoBusy,
    pendingPhotosLoadedOk,
    pendingPhotoLoadGen,
    pendingPhotoLoadPromise,
    AccountingApi: extra.AccountingApi,
    setMsg() {}
  };
  vm.createContext(sandbox);
  vm.runInContext(snippet, sandbox);
  return { sandbox, $ };
}

test('html has error region and retry copy (no silent catch)', () => {
  assert.ok(html.includes('id="pendingPhotoError"'));
  assert.ok(html.includes('pendingPhotosLoadedOk'));
  assert.ok(html.includes('pendingPhotoLoadGen'));
  assert.ok(html.includes('照片帶入中'));
  assert.ok(html.includes('LINE 照片沒帶到，仍要送出'));
  assert.ok(html.includes('再帶一次照片'));
  assert.ok(html.includes('loadPendingPhotos(queryParams.pending).catch(function () {})'));
  assert.ok(!html.includes('await loadPendingPhotos(queryParams.pending)'));
});

test('fetchPendingPhotosRetry calls API twice on failure then throws', async () => {
  let calls = 0;
  const { sandbox } = bootIngestApi({
    AccountingApi: {
      post: async () => {
        calls++;
        return { success: false, message: 'boom' };
      }
    }
  });
  let threw = false;
  try {
    await vm.runInContext('fetchPendingPhotosRetry("tok1")', sandbox);
  } catch (e) {
    threw = true;
  }
  assert.equal(threw, true);
  assert.equal(calls, 2);
});

test('loadPendingPhotos shows carry error instead of leaving silent 0 photos', async () => {
  let calls = 0;
  const { sandbox, $ } = bootIngestApi({
    AccountingApi: {
      post: async () => {
        calls++;
        throw new Error('network');
      }
    }
  });
  await vm.runInContext('loadPendingPhotos("tok1")', sandbox);
  const errBox = $('pendingPhotoError');
  assert.equal(errBox.classList._hidden, false);
  assert.ok(errBox.childNodes.some((n) => n.textContent && n.textContent.includes('不代表你沒傳圖')));
  assert.equal($('photoCountLine').textContent, '已 0 張');
  assert.equal(calls, 2, 'auto-retry once inside loadPendingPhotos');
});

test('loadPendingPhotos success with 0 incoming restores count when list already has photos', async () => {
  const { sandbox, $ } = bootIngestApi({
    AccountingApi: {
      post: async () => ({ success: true, photos: [] })
    }
  });
  sandbox.pendingPhotos.push({ dataBase64: 'abc', mimeType: 'image/jpeg' });
  await vm.runInContext('loadPendingPhotos("tok1")', sandbox);
  assert.equal($('photoCountLine').textContent, '已 1 張');
  assert.equal($('pendingPhotoError').classList._hidden, true);
});

test('pendingPhotosLoadedOk blocks second load from clearing photos', async () => {
  let calls = 0;
  const { sandbox } = bootIngestApi({
    AccountingApi: {
      post: async () => {
        calls++;
        if (calls === 1) {
          return { success: true, photos: [{ dataBase64: 'abc', mimeType: 'image/jpeg' }] };
        }
        return { success: true, photos: [] };
      }
    }
  });
  await vm.runInContext('loadPendingPhotos("tok1")', sandbox);
  assert.equal(sandbox.pendingPhotos.length, 1);
  assert.equal(sandbox.pendingPhotosLoadedOk, true);
  await vm.runInContext('loadPendingPhotos("tok1")', sandbox);
  assert.equal(sandbox.pendingPhotos.length, 1, 'second boot must not wipe with empty API');
  assert.equal(calls, 1);
});

test('clear-before-load: stale response does not attach photos to next entry', async () => {
  let resolvePost;
  const { sandbox } = bootIngestApi({
    AccountingApi: {
      post: () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        })
    }
  });
  const loadP = vm.runInContext('loadPendingPhotos("tok1")', sandbox);
  assert.equal(sandbox.pendingPhotoBusy, true);
  vm.runInContext('invalidatePendingPhotoLoads(); pendingPhotos = [];', sandbox);
  resolvePost({
    success: true,
    photos: [{ dataBase64: 'late', mimeType: 'image/jpeg' }]
  });
  await loadP;
  assert.equal(sandbox.pendingPhotos.length, 0, 'late photos discarded after clear');
});

test('submit-before-load: wait for in-flight load then snapshot includes photos', async () => {
  let resolvePost;
  const { sandbox } = bootIngestApi({
    AccountingApi: {
      post: () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        })
    }
  });
  const loadP = vm.runInContext('loadPendingPhotos("tok1")', sandbox);
  assert.equal(sandbox.pendingPhotoBusy, true);
  const waitP = vm.runInContext('pendingPhotoLoadPromise', sandbox);
  resolvePost({
    success: true,
    photos: [{ dataBase64: 'ok', mimeType: 'image/jpeg' }]
  });
  await waitP;
  await loadP;
  assert.equal(sandbox.pendingPhotos.length, 1);
  const snapLen = vm.runInContext('pendingPhotos.slice().length', sandbox);
  assert.equal(snapLen, 1);
  vm.runInContext('invalidatePendingPhotoLoads()', sandbox);
  resolvePost = null;
  assert.equal(sandbox.pendingPhotoLoadGen, 1);
});

test('double-click during photo wait yields exactly one form submit', async () => {
  let resolvePending;
  let formSubmits = 0;
  const { sandbox } = bootSubmitFlow({
    queryParams: { pending: 'tok1' },
    AccountingApi: {
      post: async (body) => {
        if (body.action === 'accounting_pending_photos') {
          return new Promise((resolve) => {
            resolvePending = resolve;
          });
        }
        if (body.action === 'accounting_form_submit') {
          formSubmits++;
          return { success: true, sheet: 'S', row: 1 };
        }
        throw new Error('unexpected action ' + body.action);
      }
    }
  });
  vm.runInContext('loadPendingPhotos("tok1")', sandbox);
  assert.equal(sandbox.pendingPhotoBusy, true);
  const first = vm.runInContext('simulateIngestSubmit()', sandbox);
  const second = vm.runInContext('simulateIngestSubmit()', sandbox);
  resolvePending({
    success: true,
    photos: [{ dataBase64: 'ok', mimeType: 'image/jpeg' }]
  });
  await Promise.all([first, second]);
  assert.equal(formSubmits, 1);
});

test('failed LINE photo load asks before submit; cancel skips post', async () => {
  let formSubmits = 0;
  const { sandbox } = bootSubmitFlow({
    queryParams: { pending: 'tok1' },
    askSubmitAnswer: false,
    AccountingApi: {
      post: async (body) => {
        if (body.action === 'accounting_pending_photos') {
          throw new Error('network');
        }
        if (body.action === 'accounting_form_submit') {
          formSubmits++;
          return { success: true, sheet: 'S', row: 1 };
        }
        throw new Error('unexpected');
      }
    }
  });
  await vm.runInContext('loadPendingPhotos("tok1")', sandbox);
  await vm.runInContext('simulateIngestSubmit()', sandbox);
  assert.equal(formSubmits, 0);
});

test('failed LINE photo load confirm ok proceeds to submit', async () => {
  let formSubmits = 0;
  const { sandbox } = bootSubmitFlow({
    queryParams: { pending: 'tok1' },
    askSubmitAnswer: true,
    AccountingApi: {
      post: async (body) => {
        if (body.action === 'accounting_pending_photos') {
          throw new Error('network');
        }
        if (body.action === 'accounting_form_submit') {
          formSubmits++;
          return { success: true, sheet: 'S', row: 1 };
        }
        throw new Error('unexpected');
      }
    }
  });
  await vm.runInContext('loadPendingPhotos("tok1")', sandbox);
  await vm.runInContext('simulateIngestSubmit()', sandbox);
  assert.equal(formSubmits, 1);
});
