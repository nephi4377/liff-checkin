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
    var revoked = detail.revoked_portal_bindings || [];
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

    function menuTools(b) {
      return '<div style="margin-top:8px">' +
        '<button type="button" class="btn btn-secondary btn-sm" data-menu-status="' + esc(b.binding_id) + '">查看選單／掛載紀錄</button> ' +
        '<button type="button" class="btn btn-secondary btn-sm" data-menu-sync="' + esc(b.binding_id) + '">重新同步選單</button>' +
        '<div class="sub" data-menu-result="' + esc(b.binding_id) + '" style="overflow-wrap:anywhere"></div></div>';
    }
    var listHtml = bindings.length ? bindings.map(function (b) {
      var title = b.customer_name ? (esc(b.customer_name) + ' · ') : '';
      var codesHint = b.official_project_codes
        ? '<div class="mono">顧客列表案號：' + esc(b.official_project_codes) + '</div>' : '';
      return '<div class="bind-row">' +
        '<div><strong>' + title + esc(b.customer_line_user_id || '') + '</strong>' +
        codesHint +
        '<div class="mono">綁定於 ' + esc(b.bound_at || '') + '</div>' + menuTools(b) + '</div>' +
        '<button type="button" class="btn btn-danger btn-sm" data-revoke="' + esc(b.binding_id) + '">解除</button></div>';
    }).join('') : '<p class="sub">尚無綁定客戶（客戶無法從 LINE 查看本案追加減／收款）</p>';

    container.innerHTML =
      '<p class="sub">綁定後客戶才可從 LIFF 查看並確認本案追加減／收款。綁定時會同步追加案號至顧客列表（若尚未存在）。</p>' +
      warnHtml +
      '<h4 style="margin-top:12px">已綁定</h4>' + listHtml +
      (revoked.length ? '<details style="margin-top:12px"><summary>最近解除的綁定</summary>' + revoked.map(function (b) {
        return '<div class="bind-row"><div>' + esc(b.customer_name || b.customer_line_user_id) +
          '<div class="mono">解除於 ' + esc(b.revoked_at || '') + '</div>' + menuTools(b) + '</div></div>';
      }).join('') + '</details>' : '') +
      '<p class="sub">選單依所有有效案件同步：仍有案件保留六格，全部解除後回四格。綁錯客戶或案號時，先解除再建立正確綁定；歷史紀錄保留供查核。</p>' +
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
            .then(async function (res) {
              if (!res.success) onMsg(res.message);
              else {
                await onRefresh();
                if (res.rich_menu_sync && res.rich_menu_sync.success === true) onOk('已解除綁定並確認選單');
                else onMsg('綁定已解除，選單尚未同步。請展開「最近解除的綁定」重新同步選單。');
              }
            });
        }, { busyLabel: '處理中…', lockRoot: container });
      };
    });

    var outcomeNames = { attempted: '嘗試掛載', verified: '已確認', failed: '失敗', unknown_menu: '未知選單，待人工核對',
      unreachable: '無法取得個人資料，請確認已加官方好友且未封鎖' };
    var stageNames = { message_check: '私訊檢查', group_message_check: '客戶群組發言檢查', follow_check: '加好友檢查', guest_precondition: '四格前置',
      existing_member: '既有六格', member_after_binding: '綁定升六格', guest_rollout: '批次補四格',
      guest_inventory: '批次盤點', member_reconcile: '同步六格', guest_after_revoke: '解除後同步四格' };
    container.querySelectorAll('[data-menu-status], [data-menu-sync]').forEach(function (btn) {
      btn.onclick = function () {
        if (!session) { onMsg('尚未登入會計權限'); return; }
        var sync = btn.hasAttribute('data-menu-sync');
        var id = btn.getAttribute(sync ? 'data-menu-sync' : 'data-menu-status');
        var box = Array.prototype.find.call(container.querySelectorAll('[data-menu-result]'), function (el) {
          return el.getAttribute('data-menu-result') === id;
        });
        if (sync && !confirm('依這位客戶所有有效案件重新同步選單？仍有案件使用六格，全部解除則使用四格。')) return;
        runLocked(btn, async function () {
          box.textContent = sync ? '正在同步選單…' : '正在讀取選單…';
          try {
            if (sync) {
              var written = await AccountingApi.cfPortalMenuSync(session, id);
              if (!written.success || written.verified !== true) {
                box.textContent = written.message || '選單尚未同步完成，請稍後重試。';
                return;
              }
            }
            var res = await AccountingApi.cfPortalMenuStatus(session, id);
            if (!res.success) { box.textContent = res.message || '無法讀取選單'; return; }
            var names = { guest: '四格', member: '六格', none: '未掛載', unknown: '未知選單，待人工核對' };
            box.innerHTML = '<p>目前選單：' + esc(names[res.variant] || res.variant) + '；有效綁定：' +
              esc(String(res.active_binding_count)) + ' 筆' + (sync ? '（本次同步已確認）' : '') + '</p>' +
              '<div class="mono">' + esc(res.richMenuId || '') + '</div>' +
              '<details><summary>掛載紀錄（最新 50 筆）</summary>' +
              ((res.history || []).map(function (row) {
                return '<div style="margin:8px 0">' + esc(row.timestamp) + ' · ' + esc(stageNames[row.stage] || row.stage) +
                  ' · ' + esc(outcomeNames[row.outcome] || row.outcome) + '<div class="mono">' +
                  esc(row.previous_menu_id || '未掛載') + ' → ' + esc(row.target_menu_id || '未掛載') + '</div></div>';
              }).join('') || '<p>目前查詢範圍內無紀錄</p>') +
              (res.history_limited ? '<p>此處僅查最近 2,000 列，並顯示此客戶最新 50 筆；完整歷史請查 CustomerRichMenuAudit。</p>' : '') + '</details>';
          } catch (e) { box.textContent = '選單服務暫時無法連線，請稍後重試。'; }
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
                var inactiveHint = String(it.status || '').toLowerCase() === 'inactive'
                  ? ' <span style="color:#c0392b">〔曾標為不活躍，綁定時會自動恢復〕</span>' : '';
                return '<div class="search-hit" data-idx="' + idx + '">' +
                  esc(it.name || '—') + hint + inactiveHint +
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
                        var reactMsg = res2.customer_reactivated ? '（已恢復顧客為活躍）' : '';
                        if (typeof AccountingListCache !== 'undefined') {
                          AccountingListCache.invalidateMasterList(session, AccountingListCache.MASTER_KEYS.official_customer);
                        }
                        onOk((res2.already_bound ? '此客戶已綁定本案' : '已綁定 ' + (it.name || it.line_id)) + syncMsg + reactMsg);
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
                var reactMsg = res.customer_reactivated ? '（已恢復顧客為活躍）' : '';
                if (typeof AccountingListCache !== 'undefined') {
                  AccountingListCache.invalidateMasterList(session, AccountingListCache.MASTER_KEYS.official_customer);
                }
                onOk((res.already_bound ? '此客戶已綁定本案' : '已綁定') + syncMsg + reactMsg);
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
