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

  function vendorSearchHaystack(v) {
    if (!v) return '';
    return [
      vendorDisplayName(v),
      v.tax_id,
      v.trade_category,
      v.contact_name,
      v.note,
      v.contact_phone
    ].map(function (x) { return String(x || '').trim(); }).filter(Boolean).join(' ').toLowerCase();
  }

  function filterVendors(vendors, query, limit) {
    var q = String(query || '').trim().toLowerCase();
    var list = vendors || [];
    if (!q) return list.slice(0, limit || 8);
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      if (vendorSearchHaystack(v).indexOf(q) >= 0) out.push(v);
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
      var allVendors = getVendors() || [];
      var hits = filterVendors(allVendors, q, maxItems);
      if (!hits.length) {
        var emptyMsg = allVendors.length
          ? '名冊找不到「' + q + '」，可繼續手動輸入'
          : '廠商名冊尚未載入，請稍候或手動輸入';
        panel.innerHTML = '<div class="vendor-combo-empty">' + emptyMsg + '</div>';
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
        var trade = String(v.trade_category || '').trim();
        var label = vendorDisplayName(v);
        if (trade) label += ' · ' + trade;
        if (tax) label += '（' + tax + '）';
        btn.textContent = label;
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
      setVendor: function (v) {
        if (!v || !v.vendor_id) {
          clearPickedVendor();
          return;
        }
        inputEl.value = vendorDisplayName(v);
        setPickedVendor(v);
      },
      destroy: function () {
        hidePanel();
        clearPickedVendor();
        if (wrap.parentNode) wrap.parentNode.insertBefore(inputEl, wrap);
        wrap.remove();
      }
    };
  }

  function escapeAttr_(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function allocRowStarted_(row) {
    if (!row) return false;
    return !!(row.project_no || row.amount || String(row.item_desc || '').trim());
  }

  function allocRowTriggersNext_(row) {
    if (!row) return false;
    return !!(row.project_no || row.amount);
  }

  function allocRowHtml(idx, row, showDelete) {
    row = row || {};
    var delBtn = showDelete
      ? '<button type="button" class="alloc-rm" data-rm="' + idx + '">刪除</button>'
      : '';
    return '<div class="alloc-row" data-idx="' + idx + '">' + delBtn +
      '<div class="row2">' +
      '<div><label>案號</label><input class="alloc-pn" list="projectNoList" value="' + escapeAttr_(row.project_no) + '" placeholder="752" /></div>' +
      '<div><label>金額</label><input class="alloc-amt" type="number" inputmode="numeric" value="' + escapeAttr_(row.amount) + '" /></div>' +
      '</div>' +
      '<label>品項</label><input class="alloc-desc" type="text" value="' + escapeAttr_(row.item_desc) + '" placeholder="例：油漆、五金" />' +
      '</div>';
  }

  function summarizeAllocItemDesc_(allocations) {
    var list = allocations || [];
    if (!list.length) return '';
    if (list.length === 1) {
      return String(list[0].item_desc || '').trim() || ('案' + list[0].project_no);
    }
    return '分攤' + list.length + '案：' + list.map(function (a) {
      return '#' + a.project_no + ' $' + a.amount;
    }).join('、');
  }

  function primaryProjectNoFromAllocations_(allocations) {
    var list = allocations || [];
    if (!list.length) return '';
    if (list.length === 1) return String(list[0].project_no || '');
    return String(list[0].project_no || '') + ' 等' + list.length + '案';
  }

  function initAllocEditor(containerEl, opts) {
    var emptyRow = function () { return { project_no: '', item_desc: '', amount: '' }; };
    if (!containerEl) {
      return {
        read: function () { return []; },
        clear: function () {},
        setRows: function () {},
        validate: function () { return { ok: true, rows: [] }; }
      };
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
          item_desc: el.querySelector('.alloc-desc').value.trim(),
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

    function filledRows(rows) {
      return (rows || []).filter(allocRowStarted_);
    }

    function maybeAppendTrailingRow(rows) {
      if (!rows.length) return [emptyRow()];
      var last = rows[rows.length - 1];
      if (allocRowTriggersNext_(last)) rows.push(emptyRow());
      return rows;
    }

    function updateSum() {
      var rows = readRows();
      var last = rows[rows.length - 1];
      if (last && allocRowTriggersNext_(last)) {
        renderRows(rows.concat([emptyRow()]));
        return;
      }
      var filled = filledRows(rows);
      var sum = sumRows(filled);
      if (sumEl) sumEl.textContent = sum.toLocaleString('zh-TW');
      if (!hintEl || !amountEl) return;
      var total = parseInt(amountEl.value, 10) || 0;
      if (!filled.length) {
        hintEl.textContent = '每筆支出至少填一列：案號、品項、金額；加總須等於支付金額。';
        hintEl.classList.remove('warn');
        return;
      }
      if (total > 0 && sum !== total) {
        hintEl.textContent = '分攤合計 $' + sum.toLocaleString('zh-TW') + '，與支付金額 $' +
          total.toLocaleString('zh-TW') + ' 不同';
        hintEl.classList.add('warn');
      } else {
        hintEl.textContent = filled.length + ' 案，合計 $' + sum.toLocaleString('zh-TW');
        hintEl.classList.remove('warn');
      }
    }

    function bindRowEvents() {
      containerEl.querySelectorAll('.alloc-pn, .alloc-amt, .alloc-desc').forEach(function (inp) {
        inp.oninput = updateSum;
      });
      containerEl.querySelectorAll('.alloc-rm').forEach(function (btn) {
        btn.onclick = function () {
          var rows = readRows();
          var idx = parseInt(btn.getAttribute('data-rm'), 10);
          rows.splice(idx, 1);
          if (!rows.length) rows = [emptyRow()];
          renderRows(rows);
        };
      });
    }

    function renderRows(rows) {
      if (!rows || !rows.length) rows = [emptyRow()];
      containerEl.innerHTML = '';
      var showDel = rows.length > 1;
      rows.forEach(function (row, idx) {
        containerEl.insertAdjacentHTML('beforeend', allocRowHtml(idx, row, showDel));
      });
      bindRowEvents();
      var filled = filledRows(rows);
      var sum = sumRows(filled);
      if (sumEl) sumEl.textContent = sum.toLocaleString('zh-TW');
      if (hintEl && amountEl) {
        var total = parseInt(amountEl.value, 10) || 0;
        if (!filled.length) {
          hintEl.textContent = '每筆支出至少填一列：案號、品項、金額；加總須等於支付金額。';
          hintEl.classList.remove('warn');
        } else if (total > 0 && sum !== total) {
          hintEl.textContent = '分攤合計 $' + sum.toLocaleString('zh-TW') + '，與支付金額 $' +
            total.toLocaleString('zh-TW') + ' 不同';
          hintEl.classList.add('warn');
        } else {
          hintEl.textContent = filled.length + ' 案，合計 $' + sum.toLocaleString('zh-TW');
          hintEl.classList.remove('warn');
        }
      }
    }

    if (amountEl) amountEl.addEventListener('input', updateSum);
    renderRows([emptyRow()]);

    return {
      read: readRows,
      clear: function () { renderRows([emptyRow()]); },
      setRows: function (rows) { renderRows(maybeAppendTrailingRow(rows || [])); },
      validate: function () {
        var rows = filledRows(readRows());
        if (!rows.length) {
          return { ok: false, message: '請至少填一筆分攤明細（案號、品項、金額）' };
        }
        var sum = sumRows(rows);
        var total = amountEl ? (parseInt(amountEl.value, 10) || 0) : sum;
        for (var i = 0; i < rows.length; i++) {
          if (!rows[i].project_no) return { ok: false, message: '分攤第 ' + (i + 1) + ' 列請填案號' };
          if (!String(rows[i].item_desc || '').trim()) return { ok: false, message: '分攤第 ' + (i + 1) + ' 列請填品項' };
          if ((parseInt(rows[i].amount, 10) || 0) <= 0) return { ok: false, message: '分攤第 ' + (i + 1) + ' 列請填金額' };
        }
        if (total > 0 && sum !== total) {
          return { ok: false, message: '分攤合計須等於支付金額（$' + total.toLocaleString('zh-TW') + '）' };
        }
        return {
          ok: true,
          rows: rows,
          project_no: primaryProjectNoFromAllocations_(rows),
          item_desc: summarizeAllocItemDesc_(rows)
        };
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
    vendorSearchHaystack: vendorSearchHaystack,
    initVendorCombobox: initVendorCombobox,
    initAllocEditor: initAllocEditor,
    summarizeAllocItemDesc: summarizeAllocItemDesc_,
    primaryProjectNoFromAllocations: primaryProjectNoFromAllocations_,
    normalizeTaiwanPhone: normalizeTaiwanPhone
  };
})();
