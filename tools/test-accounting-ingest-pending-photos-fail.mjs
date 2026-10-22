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

function bootIngestApi(extra) {
  const { document, $ } = makeDom();
  const pendingPhotos = [];
  const localPhotos = [];
  let pendingPhotoBusy = false;
  let pendingPhotosLoadedOk = false;
  const profile = { userId: 'u1', displayName: 'Test' };

  const snippet = [
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
