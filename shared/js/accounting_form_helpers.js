/**
 * 會計表單共用：付款方式標籤、申請人、datalist 填充
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

  return {
    initPaymentMethodPicker: initPaymentMethodPicker,
    resolveApplicantName: resolveApplicantName,
    fillDatalist: fillDatalist,
    fillVendorDatalist: fillVendorDatalist
  };
})();
