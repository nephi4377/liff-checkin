/**
 * Payment request: LINE pending photos load failure must not look like empty upload area.
 * Run: node --test tools/test-payment-request-pending-photos-fail.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../modules/accounting/payment_request.html', import.meta.url), 'utf8');

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
      textContent: id === 'photoCountLine' ? '已 0 / 20 個' : '',
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
        return child;
      }
    };
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
  return { document, $ };
}

function bootPayApi(extra) {
  const { document, $ } = makeDom();
  const photos = [];
  let pendingPhotoBusy = false;
  let pendingPhotosLoadedOk = false;
  const session = {
    auth: { user_id: 'u1' },
    profile: { userId: 'u1' }
  };
  let qrBanner = '';

  const snippet = [
    extractFunctionBlock(html, 'humanizePendingPhotoFail'),
    extractFunctionBlock(html, 'humanLineCarryErr'),
    extractFunctionBlock(html, 'showPendingPhotoCarryError'),
    extractFunctionBlock(html, 'clearPendingPhotoCarryError'),
    'function notifyPendingPhotoFail(h) { qrBanner = h; }',
    'function markPayResumeFailed() {}',
    'function showQuickReviewStayBanner(h) { qrBanner = h; }',
    'function setWarn() {}',
    'function setOk() {}',
    'function setMsg() {}',
    'function maxPhotos() { return 20; }',
    'function uid() { return "p1"; }',
    'function renderPhotoGrid() {}',
    'function updateUploadUi() {',
    '  document.getElementById("photoCountLine").textContent = "已 " + photos.length + " / 20 個";',
    '}',
    extractFunctionBlock(html, 'applyIncomingPendingPhotos'),
    extractFunctionBlock(html, 'fetchPendingPhotosOnce'),
    extractFunctionBlock(html, 'fetchPendingPhotosRetry'),
    extractFunctionBlock(html, 'loadPendingPhotos')
  ].join('\n');

  const sandbox = {
    document,
    photos,
    pendingPhotoBusy,
    pendingPhotosLoadedOk,
    session,
    qrBanner,
    AccountingApi: extra.AccountingApi
  };
  vm.createContext(sandbox);
  vm.runInContext(snippet, sandbox);
  return { sandbox, $ };
}

test('html has error region, guard flags, no silent catch on pending', () => {
  assert.ok(html.includes('id="pendingPhotoError"'));
  assert.ok(html.includes('pendingPhotosLoadedOk'));
  assert.ok(html.includes('再帶一次照片'));
  assert.ok(!html.includes('loadPendingPhotos(queryParams.pending).catch'));
});

test('fetchPendingPhotosRetry calls API twice then throws', async () => {
  let calls = 0;
  const { sandbox } = bootPayApi({
    AccountingApi: {
      buildAuth: () => ({}),
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

test('loadPendingPhotos shows carry error on network failure', async () => {
  let calls = 0;
  const { sandbox, $ } = bootPayApi({
    AccountingApi: {
      buildAuth: () => ({}),
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
  assert.equal($('photoCountLine').textContent, '已 0 / 20 個');
  assert.equal(calls, 2);
});

test('pendingPhotosLoadedOk blocks second load from wiping photos', async () => {
  let calls = 0;
  const { sandbox } = bootPayApi({
    AccountingApi: {
      buildAuth: () => ({}),
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
  assert.equal(sandbox.photos.length, 1);
  assert.equal(sandbox.pendingPhotosLoadedOk, true);
  await vm.runInContext('loadPendingPhotos("tok1")', sandbox);
  assert.equal(sandbox.photos.length, 1);
  assert.equal(calls, 1);
});
