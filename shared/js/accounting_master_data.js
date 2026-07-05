/**
 * 會計主檔固定格式（對齊 backend/accounting-gas/SPEC/ACCOUNTING_MASTER_DATA_SPEC.md）
 */
var ACCT_ASSET_VER = '15';
var AccountingMasterData = {
  CACHE_VERSION: 1,
  /** 台灣金融機構代碼（3 碼）→ 銀行名稱，供匯款欄位即時提示 */
  taiwan_bank_codes: {
    '004': '台灣銀行', '005': '土地銀行', '006': '合作金庫', '007': '第一銀行', '008': '華南銀行',
    '009': '彰化銀行', '011': '上海商銀', '012': '台北富邦', '013': '國泰世華', '016': '高雄銀行',
    '017': '兆豐銀行', '018': '農業金庫', '021': '花旗銀行', '048': '王道銀行', '050': '台灣企銀',
    '052': '渣打銀行', '054': '台中銀行', '081': '匯豐銀行', '101': '瑞興銀行', '103': '新光銀行',
    '108': '陽信銀行', '118': '板信銀行', '147': '三信銀行', '803': '聯邦銀行', '805': '遠東銀行',
    '806': '元大銀行', '807': '永豐銀行', '808': '玉山銀行', '809': '凱基銀行', '810': '星展銀行',
    '812': '台新銀行', '815': '日盛銀行', '816': '安泰銀行', '822': '中國信託', '824': '連線銀行',
    '826': '樂天銀行'
  },
  lookupBankName: function (code) {
    var c = String(code || '').replace(/\D/g, '');
    if (!c) return '';
    while (c.length < 3) c = '0' + c;
    return this.taiwan_bank_codes[c] || '';
  },
  /** 試算表舊工種 → 現行枚舉（對齊 backend normalizeVendorTradeCategory_） */
  vendor_trade_category_migration: {
    '木工': '木作外包廠商',
    '清潔': '清潔/拆除',
    '石材': '石材/人造石',
    '系統櫃': '系統櫃/安裝師傅'
  },
  normalizeVendorTradeCategory: function (raw) {
    var tc = String(raw || '').trim();
    if (!tc) return '';
    return this.vendor_trade_category_migration[tc] || tc;
  },
  /** 會計 bootstrap（廠商／收款帳戶／列舉）— 3 天；有改動時前端 patch + 背景重讀 */
  TTL_MS: 3 * 24 * 60 * 60 * 1000,
  vendor_trade_categories: [
    '木作外包廠商', '建材', '地板', '系統櫃/安裝師傅', '五金', '廚衛', '水電', '泥作', '油漆', '石材/人造石', '玻璃',
    '金屬加工', '空調', '清潔/拆除', '家具', '其他'
  ],
  vendor_cost_types: ['純材料商', '連工帶料', '純點工'],
  vendor_coop_statuses: ['待審核', '合作中', '暫停合作'],
  vendor_payment_terms_presets: ['現結', '月結30天', '依工程進度', '其他'],
  vendor_service_area_presets: ['雙北', '桃園', '台中', '台南', '高雄', '全台'],
  margin_expense_categories: [
    '木作外包廠商', '建材', '地板', '系統櫃/安裝師傅', '五金', '廚衛', '水電', '泥作', '油漆', '石材/人造石', '玻璃',
    '金屬加工', '空調', '清潔/拆除', '家具', '材料', '人工', '交通', '基本費用', '收入', '其他'
  ],
  /** 案件毛利本案廠商 slot（偵測規則對齊 backend MasterEnums.js） */
  margin_vendor_slots: [
    { key: 'protection', label: '施工保護', trade_categories: [], cost_types: [] },
    { key: 'demolition', label: '拆除工程', trade_categories: [], cost_types: ['連工帶料', '純點工'] },
    { key: 'masonry', label: '泥作工程', trade_categories: ['泥作'], cost_types: [] },
    { key: 'plumbing_electrical', label: '水電工程', trade_categories: ['水電'], cost_types: [] },
    { key: 'building_material', label: '建材', trade_categories: ['建材'], cost_types: ['純材料商'] },
    { key: 'wood_hardware', label: '木作五金', trade_categories: ['五金'], cost_types: [] },
    { key: 'wood_labor', label: '木作工班', trade_categories: ['木作外包廠商'], cost_types: ['連工帶料', '純點工'] },
    { key: 'system_cabinet', label: '系統櫃', trade_categories: ['系統櫃/安裝師傅'], cost_types: [] },
    { key: 'paint', label: '油漆工程', trade_categories: ['油漆'], cost_types: [] },
    { key: 'kitchen', label: '廚具設備', trade_categories: ['廚衛'], cost_types: [] },
    { key: 'floor', label: '地板工程', trade_categories: ['地板'], cost_types: [] },
    { key: 'stone', label: '石材工程', trade_categories: ['石材/人造石'], cost_types: [] },
    { key: 'glass', label: '玻璃工程', trade_categories: ['玻璃'], cost_types: [] },
    { key: 'metal', label: '金屬加工', trade_categories: ['金屬加工'], cost_types: [] },
    { key: 'hvac', label: '空調工程', trade_categories: ['空調'], cost_types: [] },
    { key: 'curtain', label: '窗簾工程', trade_categories: ['其他'], cost_types: [] },
    { key: 'cleaning', label: '清潔工程', trade_categories: ['清潔/拆除'], cost_types: [] }
  ]
};
