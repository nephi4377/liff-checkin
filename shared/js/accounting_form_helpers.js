/**
 * 會計表單共用：付款方式標籤、申請人、datalist、廠商搜尋、分攤列
 */
var AccountingFormHelpers = (function () {
  function initPaymentMethodPicker(containerEl, inputEl) {
    if (!containerEl || !inputEl) return { clear: function () {} };
    function syncTagsFromInput() {
      var v = inputEl.value.trim();
      containerEl.querySelectorAll('button[data-val]').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-val') === v);
      });
    }
    containerEl.querySelectorAll('button[data-val]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var val = btn.getAttribute('data-val') || '';
        if (btn.classList.contains('active')) {
          inputEl.value = '';
          btn.classList.remove('active');
        } else {
          inputEl.value = val;
          syncTagsFromInput();
        }
      });
    });
    inputEl.addEventListener('input', syncTagsFromInput);
    return {
      clear: function () {
        inputEl.value = '';
        syncTagsFromInput();
      }
    };
  }

  function resolveApplicantName(employees, userId, displayName) {
    if (typeof AccountingContext !== 'undefined' && AccountingContext.findEmployeeByUserId) {
      var emp = AccountingContext.findEmployeeByUserId(employees, userId);
      if (emp && emp.userName) return emp.userName;
    }
    return String(displayName || '').trim();
  }

  function fillDatalist(listEl, values) {
    if (!listEl) return 0;
    var seen = {};
    listEl.innerHTML = '';
    (values || []).forEach(function (raw) {
      var v = String(raw || '').trim();
      if (!v || seen[v]) return;
      seen[v] = true;
      var opt = document.createElement('option');
      opt.value = v;
      listEl.appendChild(opt);
    });
    return Object.keys(seen).length;
  }

  function fillVendorDatalist(listEl, vendors) {
    var names = (vendors || []).map(function (v) { return v.name || v.vendor_id; });
    return fillDatalist(listEl, names);
  }

  function vendorDisplayName(v) {
    return String((v && (v.name || v.vendor_id)) || '').trim();
  }

  function filterVendors(vendors, query, limit) {
    var q = String(query || '').trim().toLowerCase();
    var list = vendors || [];
    if (!q) return list.slice(0, limit || 8);
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      var name = vendorDisplayName(v);
      var tax = String(v.tax_id || '').trim();
      var hay = (name + ' ' + tax).toLowerCase();
      if (hay.indexOf(q) >= 0) out.push(v);
      if (out.length >= (limit || 8)) break;
    }
    return out;
  }

  /**
   * 廠商輸入：打 1 個字起即時篩選名冊（手機比 datalist 好用）
   * @param {HTMLInputElement} inputEl
   * @param {function(): array} getVendors
   */
  function initVendorCombobox(inputEl, getVendors, opts) {
    if (!inputEl) return { refresh: function () {}, destroy: function () {} };
    opts = opts || {};
    var minChars = opts.minChars != null ? opts.minChars : 1;
    var maxItems = opts.maxItems || 8;

    var wrap = document.createElement('div');
    wrap.className = 'vendor-combo-wrap';
    var parent = inputEl.parentNode;
    if (parent) parent.insertBefore(wrap, inputEl);
    wrap.appendChild(inputEl);
    inputEl.removeAttribute('list');
    inputEl.setAttribute('autocomplete', 'off');

    var panel = document.createElement('div');
    panel.className = 'vendor-combo-panel hidden';
    panel.setAttribute('role', 'listbox');
    wrap.appendChild(panel);

    var activeIdx = -1;
    var pickedVendorId = '';

    function setPickedVendor(v) {
      pickedVendorId = (v && v.vendor_id) ? String(v.vendor_id) : '';
      inputEl.dataset.vendorId = pickedVendorId;
    }

    function clearPickedVendor() {
      pickedVendorId = '';
      delete inputEl.dataset.vendorId;
    }

    function syncPickedVendorFromInput() {
      var q = inputEl.value.trim();
      if (!q) {
        clearPickedVendor();
        return;
      }
      var exact = (getVendors() || []).filter(function (v) {
        return vendorDisplayName(v) === q;
      });
      if (exact.length === 1) setPickedVendor(exact[0]);
      else if (!pickedVendorId) return;
      else {
        var picked = (getVendors() || []).find(function (v) { return v.vendor_id === pickedVendorId; });
        if (!picked || vendorDisplayName(picked) !== q) clearPickedVendor();
      }
    }

    function hidePanel() {
      panel.classList.add('hidden');
      panel.innerHTML = '';
      activeIdx = -1;
    }

    function pickVendor(v) {
      inputEl.value = vendorDisplayName(v);
      setPickedVendor(v);
      hidePanel();
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function renderPanel() {
      var q = inputEl.value.trim();
      if (q.length < minChars) {
        hidePanel();
        return;
      }
      var hits = filterVendors(getVendors(), q, maxItems);
      if (!hits.length) {
        panel.innerHTML = '<div class="vendor-combo-empty">名冊找不到，可繼續手動輸入</div>';
        panel.classList.remove('hidden');
        return;
      }
      panel.innerHTML = '';
      hits.forEach(function (v, idx) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'vendor-combo-item';
        btn.setAttribute('role', 'option');
        var tax = String(v.tax_id || '').trim();
        btn.textContent = vendorDisplayName(v) + (tax ? '（' + tax + '）' : '');
        btn.addEventListener('mousedown', function (e) {
          e.preventDefault();
          pickVendor(v);
        });
        btn.addEventListener('mouseenter', function () {
          activeIdx = idx;
          syncActive();
        });
        panel.appendChild(btn);
      });
      activeIdx = 0;
      syncActive();
      panel.classList.remove('hidden');
    }

    function syncActive() {
      var items = panel.querySelectorAll('.vendor-combo-item');
      items.forEach(function (el, i) {
        el.classList.toggle('active', i === activeIdx);
      });
    }

    inputEl.addEventListener('input', function () {
      syncPickedVendorFromInput();
      renderPanel();
    });
    inputEl.addEventListener('focus', renderPanel);
    inputEl.addEventListener('blur', function () {
      setTimeout(hidePanel, 150);
    });
    inputEl.addEventListener('keydown', function (e) {
      if (panel.classList.contains('hidden')) return;
      var items = panel.querySelectorAll('.vendor-combo-item');
      if (!items.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIdx = Math.min(activeIdx + 1, items.length - 1);
        syncActive();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIdx = Math.max(activeIdx - 1, 0);
        syncActive();
      } else if (e.key === 'Enter' && activeIdx >= 0) {
        e.preventDefault();
        items[activeIdx].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      } else if (e.key === 'Escape') {
        hidePanel();
      }
    });

    return {
      refresh: function () {},
      getVendorId: function () { return pickedVendorId || inputEl.dataset.vendorId || ''; },
      clearVendorId: clearPickedVendor,
      destroy: function () {
        hidePanel();
        clearPickedVendor();
        if (wrap.parentNode) wrap.parentNode.insertBefore(inputEl, wrap);
        wrap.remove();
      }
    };
  }

  function allocRowHtml(idx, row) {
    row = row || {};
    return '<div class="alloc-row" data-idx="' + idx + '">' +
      '<button type="button" class="alloc-rm" data-rm="' + idx + '">刪除</button>' +
      '<div class="row2">' +
      '<div><label>案號</label><input class="alloc-pn" list="projectNoList" value="' + (row.project_no || '') + '" placeholder="752" /></div>' +
      '<div><label>金額</label><input class="alloc-amt" type="number" inputmode="numeric" value="' + (row.amount || '') + '" /></div>' +
      '</div></div>';
  }

  function initAllocEditor(containerEl, opts) {
    if (!containerEl) {
      return { read: function () { return []; }, clear: function () {}, setRows: function () {} };
    }
    opts = opts || {};
    var amountEl = opts.amountEl || null;
    var sumEl = opts.sumEl || null;
    var hintEl = opts.hintEl || null;

    function readRows() {
      var rows = [];
      containerEl.querySelectorAll('.alloc-row').forEach(function (el) {
        rows.push({
          project_no: el.querySelector('.alloc-pn').value.trim(),
          amount: el.querySelector('.alloc-amt').value
        });
      });
      return rows;
    }

    function sumRows(rows) {
      return rows.reduce(function (s, r) {
        return s + (parseInt(r.amount, 10) || 0);
      }, 0);
    }

    function updateSum() {
      var rows = readRows();
      var sum = sumRows(rows);
      if (sumEl) sumEl.textContent = sum.toLocaleString('zh-TW');
      if (!hintEl || !amountEl) return;
      var total = parseInt(amountEl.value, 10) || 0;
      if (!rows.length) {
        hintEl.textContent = '';
        return;
      }
      if (total > 0 && sum !== total) {
        hintEl.textContent = '分攤合計 $' + sum.toLocaleString('zh-TW') + '，與支付金額 $' +
          total.toLocaleString('zh-TW') + ' 不同';
        hintEl.classList.add('warn');
      } else {
        hintEl.textContent = rows.length + ' 案，合計 $' + sum.toLocaleString('zh-TW');
        hintEl.classList.remove('warn');
      }
    }

    function bindRowEvents() {
      containerEl.querySelectorAll('.alloc-pn, .alloc-amt').forEach(function (inp) {
        inp.oninput = updateSum;
      });
      containerEl.querySelectorAll('.alloc-rm').forEach(function (btn) {
        btn.onclick = function () {
          var rows = readRows();
          var idx = parseInt(btn.getAttribute('data-rm'), 10);
          rows.splice(idx, 1);
          renderRows(rows);
        };
      });
    }

    function renderRows(rows) {
      if (!rows || !rows.length) {
        containerEl.innerHTML = '<p class="alloc-empty">尚無分攤。點「新增一案」把一筆支出拆到多個案場。</p>';
        updateSum();
        return;
      }
      containerEl.innerHTML = '';
      rows.forEach(function (row, idx) {
        containerEl.insertAdjacentHTML('beforeend', allocRowHtml(idx, row));
      });
      bindRowEvents();
      updateSum();
    }

    function addRow() {
      var rows = readRows();
      if (!rows.length && containerEl.querySelector('.alloc-empty')) rows = [];
      rows.push({ project_no: '', amount: '' });
      renderRows(rows);
    }

    if (amountEl) amountEl.addEventListener('input', updateSum);

    return {
      read: readRows,
      clear: function () { renderRows([]); },
      setRows: renderRows,
      addRow: addRow,
      validate: function () {
        var rows = readRows().filter(function (r) {
          return r.project_no || r.amount;
        });
        if (!rows.length) return { ok: true, rows: [] };
        var sum = sumRows(rows);
        var total = amountEl ? (parseInt(amountEl.value, 10) || 0) : sum;
        for (var i = 0; i < rows.length; i++) {
          if (!rows[i].project_no) return { ok: false, message: '分攤第 ' + (i + 1) + ' 列請填案號' };
          if ((parseInt(rows[i].amount, 10) || 0) <= 0) return { ok: false, message: '分攤第 ' + (i + 1) + ' 列請填金額' };
        }
        if (total > 0 && sum !== total) {
          return { ok: false, message: '分攤合計須等於支付金額（$' + total + '）' };
        }
        return { ok: true, rows: rows };
      }
    };
  }

  function normalizeTaiwanPhone(value) {
    if (value == null || value === '') return '';
    var s;
    if (typeof value === 'number' && isFinite(value)) {
      s = Math.floor(value) === value ? String(Math.trunc(value)) : String(value);
    } else {
      s = String(value).replace(/\D/g, '');
    }
    if (!s) return '';
    if (s.length === 7) return s;
    if (s.charAt(0) !== '0') s = '0' + s;
    return s;
  }

  return {
    initPaymentMethodPicker: initPaymentMethodPicker,
    resolveApplicantName: resolveApplicantName,
    fillDatalist: fillDatalist,
    fillVendorDatalist: fillVendorDatalist,
    filterVendors: filterVendors,
    initVendorCombobox: initVendorCombobox,
    initAllocEditor: initAllocEditor,
    normalizeTaiwanPhone: normalizeTaiwanPhone
  };
})();
