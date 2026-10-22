/**
 * Accounting lightbox: attachment fetch failure must not look like "no documents".
 * Run: node --test tools/test-accounting-lightbox-attach-fail.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const lbSrc = readFileSync(new URL('../shared/js/accounting_lightbox.js', import.meta.url), 'utf8');

function makeDomStub() {
  function el() {
    return {
      className: '',
      classList: { add() {}, remove() {}, toggle() {} },
      style: {},
      textContent: '',
      innerHTML: '',
      disabled: false,
      addEventListener() {},
      querySelector() { return el(); },
      appendChild() {}
    };
  }
  const win = {
    location: { hostname: '127.0.0.1', search: '' },
    document: null
  };
  win.document = {
    head: { appendChild() {} },
    body: { appendChild() {} },
    createElement() { return el(); },
    getElementById() { return el(); },
    addEventListener() {},
    removeEventListener() {}
  };
  return win;
}

function bootContext(extra) {
  const win = makeDomStub();
  return vm.createContext(Object.assign({
    window: win,
    document: win.document,
    URLSearchParams,
    setTimeout,
    clearTimeout
  }, extra || {}));
}

function bootLightbox(extra) {
  const sandbox = bootContext(extra);
  vm.runInContext(lbSrc, sandbox);
  return sandbox;
}

test('fetchAttachmentUrls throws after retry when API keeps failing', async () => {
  let calls = 0;
  const ctx = bootLightbox({
    AccountingApi: {
      crudList: async () => {
        calls++;
        return { success: false, message: 'boom' };
      }
    }
  });
  let threw = false;
  try {
    await vm.runInContext(
      'AccountingLightbox.fetchAttachmentUrls({ auth: {} }, { payment_request_id: "pr1" })',
      ctx
    );
  } catch (e) {
    threw = true;
    assert.equal(e && e.code, 'ATTACH_FETCH_FAILED');
  }
  assert.equal(threw, true, 'fetchAttachmentUrls should throw on persistent API failure');
  assert.equal(calls, 2, 'should auto-retry once');
});

test('makeButton shows retry label on failure, not hidden empty state', async () => {
  const ctx = bootLightbox({
    AccountingApi: {
      crudList: async () => ({ success: false, message: 'fail' })
    }
  });
  const btn = vm.runInContext(
    'AccountingLightbox.makeButton({ auth: {} }, { payment_request_id: "pr1" }, "看單據")',
    ctx
  );
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(btn.textContent, '單據讀不到，再試');
  assert.notEqual(btn.style.display, 'none');
});

test('makeButton shows 沒有單據 only when API succeeds with empty list', async () => {
  const ctx = bootLightbox({
    AccountingApi: {
      crudList: async () => ({ success: true, data: [] })
    }
  });
  const btn = vm.runInContext(
    'AccountingLightbox.makeButton({ auth: {} }, { payment_request_id: "pr1" }, "看單據")',
    ctx
  );
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(btn.textContent, '沒有單據');
  assert.equal(btn.disabled, true);
});
