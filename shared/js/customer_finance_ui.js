/**
 * B5 追加減／收款 — 按鈕防連點與處理中狀態
 */
var CustomerFinanceUi = (function () {
  var busyMap = new WeakMap();

  function applyBtnBusy(btn, busyLabel, lockRoot) {
    if (!btn) return;
    if (!busyMap.has(btn)) {
      busyMap.set(btn, { text: btn.textContent, disabled: btn.disabled });
    }
    btn.disabled = true;
    btn.textContent = busyLabel;
    btn.setAttribute('aria-busy', 'true');
    btn.classList.add('is-busy');
    if (lockRoot) {
      lockRoot.querySelectorAll('button').forEach(function (b) {
        if (b !== btn) b.disabled = true;
      });
    }
  }

  function clearBtnBusy(btn, lockRoot) {
    if (btn) {
      var prev = busyMap.get(btn);
      if (prev) {
        btn.textContent = prev.text;
        btn.disabled = prev.disabled;
        busyMap.delete(btn);
      } else {
        btn.disabled = false;
      }
      btn.removeAttribute('aria-busy');
      btn.classList.remove('is-busy');
    }
    if (lockRoot) {
      lockRoot.querySelectorAll('button').forEach(function (b) {
        if (b !== btn) b.disabled = false;
      });
    }
  }

  function deferAfterPaint(fn) {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () {
        requestAnimationFrame(fn);
      });
    } else {
      setTimeout(fn, 0);
    }
  }

  function runBtnAsync(btn, fn, opts) {
    opts = opts || {};
    if (btn && (btn.disabled || btn.getAttribute('aria-busy') === 'true')) {
      return Promise.resolve();
    }
    var busyLabel = opts.busyLabel || '處理中…';
    var lockRoot = opts.lockRoot || null;
    applyBtnBusy(btn, busyLabel, lockRoot);
    return new Promise(function (resolve, reject) {
      deferAfterPaint(function () {
        Promise.resolve()
          .then(fn)
          .then(resolve, reject)
          .finally(function () {
            clearBtnBusy(btn, lockRoot);
          });
      });
    });
  }

  return { runBtnAsync: runBtnAsync, applyBtnBusy: applyBtnBusy };
})();
