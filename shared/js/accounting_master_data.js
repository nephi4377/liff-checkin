/**
 * 會計主檔固定格式（對齊 backend/accounting-gas/SPEC/ACCOUNTING_MASTER_DATA_SPEC.md）
 */
var ACCT_ASSET_VER = '11';
var AccountingMasterData = {
  CACHE_VERSION: 1,
  /** 會計 bootstrap（廠商／收款帳戶／列舉）— 3 天；有改動時前端 patch + 背景重讀 */
  TTL_MS: 3 * 24 * 60 * 60 * 1000,
  vendor_trade_categories: ['木工', '系統櫃', '五金', '廚衛', '水電', '泥作', '油漆', '石材', '玻璃', '金屬加工', '空調', '清潔', '其他'],
  vendor_cost_types: ['純材料商', '連工帶料', '純點工'],
  vendor_coop_statuses: ['待審核', '合作中', '暫停合作'],
  vendor_payment_terms_presets: ['現結', '月結30天', '依工程進度', '其他'],
  vendor_service_area_presets: ['雙北', '桃園', '台中', '台南', '高雄', '全台'],
  margin_expense_categories: [
    '木工', '系統櫃', '五金', '廚衛', '水電', '泥作', '油漆', '石材', '玻璃', '金屬加工', '空調', '清潔',
    '材料', '人工', '交通', '收入', '其他'
  ]
};
