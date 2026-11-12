/**
 * QUOTE-EDITOR-3 本機殼：員工預覽／假資料（僅 127.0.0.1；案號任意數字）
 * 正式站永不啟用；不影響簽約／算薪／打卡等其他模組。
 */
(function (root) {
  var TEST_PROJECT = '999';

  function qs(name) {
    try {
      return new URLSearchParams(location.search).get(name) || '';
    } catch (e) {
      return '';
    }
  }

  function isLocalHost() {
    try {
      var h = String((location && location.hostname) || '').toLowerCase();
      return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '0.0.0.0';
    } catch (e2) {
      return false;
    }
  }

  function projectNoFromUrl() {
    return String(qs('project_no') || qs('projectNo') || '').trim();
  }

  function isStaffPreviewQuery() {
    var v = qs('staff_preview') || qs('preview') || '';
    return v === '1' || v === 'true' || qs('dev') === '1';
  }

  /** 本機員工預覽：不走 LIFF，避免被導向 LINE 400 */
  function isLocalStaffPreview() {
    return isLocalHost() && isStaffPreviewQuery();
  }

  /** 本機假資料：?fixture=1 強制，或 ?dev=1 可作 API 失敗後備（任意數字案號） */
  function canUseLocalFixture(projectNo) {
    if (!isLocalHost()) return false;
    var pno = String(projectNo || projectNoFromUrl() || '').trim();
    if (!pno || !/^\d+$/.test(pno)) return false;
    return qs('fixture') === '1' || qs('dev') === '1';
  }

  function buildLocalStaffSession() {
    return {
      fromHub: true,
      localPreview: true,
      profile: { userId: 'Ustafflocal', displayName: '本機員工預覽' },
      idToken: '',
      auth: {
        success: true,
        user_id: 'Ustafflocal',
        display_name: '本機員工預覽',
        permission: 5
      }
    };
  }

  function buildLocalCustomerSession() {
    return {
      localPreview: true,
      idToken: '',
      customerAccessToken: 'local-dev',
      profile: { userId: 'Ulocaltestlocaltestlocaltestloca', displayName: '本機測試客戶' },
      portal: { ok: true, project_no: TEST_PROJECT }
    };
  }

  function fixtureStaffPayload(projectNo) {
    var pno = String(projectNo || TEST_PROJECT).trim() || TEST_PROJECT;
    var quote = {
      quote_id: 'qe-local-' + pno,
      project_no: pno,
      version: 1,
      status: 'draft',
      quote_date: '2026-11-10',
      fees_received: { measure: 3000, startup: 10000, planning: 0 },
      zones: [{
        zone_id: 'z-local-1',
        name: '客廳',
        lines: [{
          line_id: 'l-local-1',
          item: '開門高衣櫃-D60H240內',
          note: '本機假資料｜含門片',
          unit: '尺',
          qty: 1.5,
          unit_price: 6100,
          amount: 9150,
          tab: '木作工程',
          is_cabinet: true,
          line_subtotal: 10350,
          addons: [{
            line_id: 'l-local-a1',
            item: '抽屜組-標準',
            note: '掛櫃附加（假資料）',
            unit: '組',
            qty: 1,
            unit_price: 1200,
            amount: 1200,
            tab: '木作工程',
            parent_line_id: 'l-local-1'
          }]
        }, {
          line_id: 'l-local-2',
          item: '矽酸鈣/石膏天花板-水泥漆',
          note: '本機假資料',
          unit: '坪',
          qty: 10,
          unit_price: 1650,
          amount: 16500,
          tab: '油漆工程',
          addons: []
        }],
        trade_groups: [
          { tab: '木作工程', subtotal: 10350 },
          { tab: '油漆工程', subtotal: 16500 }
        ],
        zone_subtotal: 26850
      }],
      notes: '本機假資料（後端 #312 未部署時用）'
    };
    var totals = {
      pretax: 26850,
      tax: 1343,
      tax_rate: 0.05,
      with_tax: 28193,
      deducted: 13000,
      payable: 15193
    };
    return {
      success: true,
      staff: {
        quote: quote,
        totals: totals,
        versions: [],
        editable: true,
        feature_enabled: true,
        project_allowed: true,
        contract_handoff: { total_with_tax: totals.with_tax },
        local_fixture: true
      },
      local_fixture: true
    };
  }

  function fixtureCatalogItems() {
    return [
      {
        item: '開門高衣櫃-D60H240內', unit: '尺', price: 6100, tab: '木作工程',
        note: '含門片', catalog_key: '木作工程::開門高衣櫃-D60H240內', likely_cabinet: true
      },
      {
        item: '抽屜組-標準', unit: '組', price: 1200, tab: '木作工程',
        note: '櫃體加購', catalog_key: '木作工程::抽屜組-標準', likely_addon: true
      },
      {
        item: '拉籃', unit: '組', price: 1800, tab: '木作工程',
        note: '櫃體加購', catalog_key: '木作工程::拉籃', likely_addon: true
      },
      {
        item: '矽酸鈣/石膏天花板-水泥漆', unit: '坪', price: 1650, tab: '油漆工程',
        note: '', catalog_key: '油漆工程::矽酸鈣/石膏天花板-水泥漆'
      }
    ];
  }

  function fixtureCatalogPayload() {
    return {
      success: true,
      tabs: ['木作工程', '油漆工程', '水電工程'],
      selected_tab: '',
      items: [],
      need_tab: true,
      feature_enabled: true,
      project_allowed: true,
      local_fixture: true
    };
  }

  function fixtureCustomerPayload(projectNo) {
    var staff = fixtureStaffPayload(projectNo);
    var q = staff.staff.quote;
    var customerQuote = {
      project_no: q.project_no,
      quote_id: q.quote_id,
      version: q.version,
      status: q.status,
      quote_date: q.quote_date,
      fees_received: q.fees_received,
      totals: staff.staff.totals,
      notes: q.notes,
      can_confirm: false,
      confirmed_at: '',
      zones: (q.zones || []).map(function (z) {
        return {
          zone_id: z.zone_id,
          name: z.name,
          zone_subtotal: z.zone_subtotal,
          trade_groups: z.trade_groups,
          lines: (z.lines || []).map(function (ln) {
            return {
              line_id: ln.line_id,
              item: ln.item,
              note: ln.note,
              unit: ln.unit,
              qty: ln.qty,
              amount: ln.amount,
              tab: ln.tab,
              is_cabinet: !!ln.is_cabinet,
              line_subtotal: ln.line_subtotal,
              addons: (ln.addons || []).map(function (a) {
                return {
                  line_id: a.line_id,
                  item: a.item,
                  note: a.note,
                  unit: a.unit,
                  qty: a.qty,
                  amount: a.amount,
                  tab: a.tab
                };
              })
            };
          })
        };
      })
    };
    return {
      success: true,
      quote: customerQuote,
      local_fixture: true
    };
  }

  root.QuoteEditorLocal = {
    TEST_PROJECT: TEST_PROJECT,
    isLocalHost: isLocalHost,
    isLocalStaffPreview: isLocalStaffPreview,
    canUseLocalFixture: canUseLocalFixture,
    buildLocalStaffSession: buildLocalStaffSession,
    buildLocalCustomerSession: buildLocalCustomerSession,
    fixtureStaffPayload: fixtureStaffPayload,
    fixtureCatalogPayload: fixtureCatalogPayload,
    fixtureCatalogItems: fixtureCatalogItems,
    fixtureCustomerPayload: fixtureCustomerPayload
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.QuoteEditorLocal;
  }
})(typeof window !== 'undefined' ? window : globalThis);
