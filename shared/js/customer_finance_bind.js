/**
 * B5 客戶 LINE 綁定 UI（設計師頁與案場更新頁共用）
 */
var CustomerFinanceBind = (function () {
  function runLocked(btn, fn, opts) {
    if (typeof CustomerFinanceUi !== 'undefined') {
      return CustomerFinanceUi.runBtnAsync(btn, fn, opts);
    }
    return Promise.resolve().then(fn);
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function render(container, opts) {
    opts = opts || {};
    var session = opts.session;
    var projectNo = String(opts.projectNo || '').trim();
    var detail = opts.detail || {};
    var bindings = detail.portal_bindings || [];
    var warnings = detail.unbound_customer_warnings || [];
    var onMsg = opts.onMsg || function () {};
    var onOk = opts.onOk || function () {};
    var onRefresh = opts.onRefresh || function () {};

    if (!container || !projectNo) {
      if (container) container.innerHTML = '<p class="sub">請先選擇案號</p>';
      return;
    }

    var warnHtml = warnings.length
      ? '<div class="warn-box"><strong>⚠ 顧客列表已有本案號但未綁定 LIFF</strong><br>' +
        warnings.map(function (w) {
          return esc(w.customer_name || '（無名稱）') + ' · ' + esc(w.customer_line_user_id || '') +
            (w.project_codes ? ' · 案號：' + esc(w.project_codes) : '');
        }).join('<br>') + '</div>'
      : '';

    var listHtml = bindings.length ? bindings.map(function (b) {
      var title = b.customer_name ? (esc(b.customer_name) + ' · ') : '';
      var codesHint = b.official_project_codes
        ? '<div class="mono">顧客列表案號：' + esc(b.official_project_codes) + '</div>' : '';
      return '<div class="bind-row">' +
        '<div><strong>' + title + esc(b.customer_line_user_id || '') + '</strong>' +
        codesHint +
        '<div class="mono">綁定於 ' + esc(b.bound_at || '') + '</div></div>' +
        '<button type="button" class="btn btn-danger btn-sm" data-revoke="' + esc(b.binding_id) + '">解除</button></div>';
    }).join('') : '<p class="sub">尚無綁定客戶（客戶無法從 LINE 查看本案追加減／收款）</p>';

    container.innerHTML =
      '<p class="sub">綁定後客戶才可從 LIFF 查看並確認本案追加減／收款。綁定時會同步追加案號至顧客列表（若尚未存在）。</p>' +
      warnHtml +
      '<h4 style="margin-top:12px">已綁定</h4>' + listHtml +
      '<h4 style="margin-top:16px">新增綁定</h4>' +
      '<label>搜尋官方 LINE 顧客列表（名稱／案號／UID）</label>' +
      '<div style="display:flex;gap:8px;margin-top:4px">' +
      '<input id="cfBindSearchKw" placeholder="例：王小姐、752、U 開頭" style="flex:1;margin-top:0" />' +
      '<button type="button" class="btn btn-secondary" id="cfBtnBindSearch" style="margin-top:0;white-space:nowrap">搜尋</button></div>' +
      '<div id="cfBindSearchResults"></div>' +
      '<label style="margin-top:12px">或手動貼 LINE userId</label>' +
      '<input id="cfBindLineUid" placeholder="Uxxxxxxxx" class="mono" />' +
      '<button type="button" class="btn btn-primary" id="cfBtnBind">建立綁定</button>';

    container.querySelectorAll('[data-revoke]').forEach(function (btn) {
      btn.onclick = function () {
        if (!session) { onMsg('尚未登入會計權限'); return; }
        if (!confirm('確定解除這位客戶的綁定？解除後客戶將無法查看本案。')) return;
        runLocked(btn, function () {
          return AccountingApi.cfPortalRevoke(session, btn.getAttribute('data-revoke'))
            .then(function (res) {
              if (!res.success) onMsg(res.message);
              else { onOk('已解除綁定'); return onRefresh(); }
            });
        }, { busyLabel: '處理中…', lockRoot: container });
      };
    });

    var btnSearch = container.querySelector('#cfBtnBindSearch');
    var btnBind = container.querySelector('#cfBtnBind');
    var searchResults = container.querySelector('#cfBindSearchResults');
    var searchKw = container.querySelector('#cfBindSearchKw');
    var lineUid = container.querySelector('#cfBindLineUid');

    if (btnSearch) {
      btnSearch.onclick = function () {
        if (!session) { onMsg('尚未登入會計權限'); return; }
        var kw = searchKw.value.trim();
        if (!kw) { onMsg('請輸入搜尋關鍵字'); return; }
        onMsg('');
        searchResults.innerHTML = '<p class="sub">搜尋中…</p>';
        runLocked(btnSearch, function () {
          return AccountingApi.cachedOfficialCustomerSearch(session, kw)
            .then(function (res) {
              if (!res.success) {
                searchResults.innerHTML = '<p class="sub">' + esc(res.message || '搜尋失敗') + '</p>';
                return;
              }
              var items = res.items || [];
              if (!items.length) {
                searchResults.innerHTML = '<p class="sub">找不到符合的客戶，可改用手動貼 UID。</p>';
                return;
              }
              searchResults.innerHTML = items.map(function (it, idx) {
                var codes = String(it.project_codes || '');
                var hasThis = codes.indexOf(projectNo) >= 0;
                var hint = hasThis ? '（顧客列表已有本案號）' : (codes ? '（顧客列表案號：' + esc(codes) + '）' : '（顧客列表尚未填案號）');
                return '<div class="search-hit" data-idx="' + idx + '">' +
                  esc(it.name || '—') + hint +
                  '<small class="mono">' + esc(it.line_id || '') + ' · ' + (it.id_type === 'group' ? '群組' : '個人') + '</small></div>';
              }).join('');
              searchResults.querySelectorAll('.search-hit').forEach(function (el) {
                el.onclick = function () {
                  var it = items[Number(el.getAttribute('data-idx'))];
                  if (!it || !it.line_id) return;
                  if (it.id_type === 'group') {
                    onMsg('群組 GID 無法用於客戶 LIFF 個人登入，請選個人 UID 或請客戶用個人帳號加好友。');
                    return;
                  }
                  runLocked(el, function () {
                    return AccountingApi.cfPortalBind(session, {
                      project_no: projectNo,
                      customer_line_user_id: it.line_id,
                      note: 'from:official_customer_list'
                    }).then(function (res2) {
                      if (!res2.success) onMsg(res2.message);
                      else {
                        var syncMsg = res2.customer_list_sync && res2.customer_list_sync.updated
                          ? '（已同步顧客列表案號）' : '';
                        if (typeof AccountingListCache !== 'undefined') {
                          AccountingListCache.invalidateMasterList(session, AccountingListCache.MASTER_KEYS.official_customer);
                        }
                        onOk((res2.already_bound ? '此客戶已綁定本案' : '已綁定 ' + (it.name || it.line_id)) + syncMsg);
                        return onRefresh();
                      }
                    });
                  }, { busyLabel: '綁定中…', lockRoot: container });
                };
              });
            });
        }, { busyLabel: '搜尋中…', lockRoot: container });
      };
    }

    if (btnBind) {
      btnBind.onclick = function () {
        if (!session) { onMsg('尚未登入會計權限'); return; }
        var uid = lineUid.value.trim();
        if (!uid) { onMsg('請填 userId'); return; }
        runLocked(btnBind, function () {
          return AccountingApi.cfPortalBind(session, { project_no: projectNo, customer_line_user_id: uid })
            .then(function (res) {
              if (!res.success) onMsg(res.message);
              else {
                var syncMsg = res.customer_list_sync && res.customer_list_sync.updated
                  ? '（已同步顧客列表案號）' : '';
                onOk((res.already_bound ? '此客戶已綁定本案' : '已綁定') + syncMsg);
                lineUid.value = '';
                return onRefresh();
              }
            });
        }, { busyLabel: '綁定中…', lockRoot: container });
      };
    }
  }

  return { render: render };
})();
