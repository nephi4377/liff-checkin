'use strict';
  var STORAGE_KEY = 'qr_estimator_settings_v2';
  /** 管理員「本機備份快照」清單（與主設定分開存） */
  var SNAPSHOTS_STORAGE_KEY = 'qr_estimator_snapshots_v1';
  var SNAPSHOTS_MAX = 25;
  var TABS_CACHE_KEY = 'qr_price_tabs_v1'; /* 工作頁快取（獨立 key，還原全預設不影響） */
  var FB_CONFIG_STORAGE_KEY = 'fb_audit_config';
  var FB_RTDB_SETTINGS_PATH = 'quickRenovationQuote/settingsV2';
  var FB_CONFIG_DEFAULT = {
    databaseURL: 'https://brave-calling-391208-default-rtdb.asia-southeast1.firebasedatabase.app',
    apiKey: '',
    authDomain: '',
    projectId: '',
  };
  var PING_TO_M2 = 3.305785124;
  var SCHEMA_V = 5;

  /** 客戶端／方案菜單表頭分群（數字愈小愈上面） */
  function menuBandOrderKey(band) {
    var M = {
      wood_full: 5,
      zone_lk: 20,
      zone_master: 30,
      zone_bed: 35,
      floor: 50,
      paint: 60,
      mep: 70,
      protect: 80,
      finish: 90,
      other: 99,
    };
    return M[band] != null ? M[band] : M.other;
  }

  var MENU_BAND_LABEL_ZH = {
    wood_full: '全室木作',
    zone_lk: '客餐廳木作',
    zone_master: '主臥木作',
    zone_bed: '次臥木作',
    floor: '地板工程（依空間）',
    paint: '油漆工程',
    mep: '水電工程',
    protect: '保護工程',
    finish: '收邊與細清',
    other: '其他',
  };

  function cloneR(r) {
    return JSON.parse(JSON.stringify(r));
  }
  function defaultSchemeRulesBase() {
    return {
      ceiling: { type: 'ceil_ping_lk_beds' },
      floor_p: { type: 'floor_115' },
      shoe_lk: { type: 'fixed_shaku', value: 3 },
      storage_40: { type: 'fixed_shaku', value: 4 },
      sideboard_60: { type: 'fixed_shaku', value: 0 },
      tv_wall: { type: 'shaku_edge_scaled', zone: 'lk', edge: 'long', scale: 0.3 },
      sofa_wall: { type: 'shaku_edge_scaled', zone: 'lk', edge: 'short', scale: 0.35 },
      ac_lk: { type: 'short_shaku_zone', zone: 'lk', edge: 'short' },
      curtain_lk: { type: 'fixed_shaku', value: 4 },
      service_hatch: { type: 'fixed_shaku', value: 0 },
      appliance_lk: { type: 'fixed_shaku', value: 0 },
      tall_cab: { type: 'fixed_shaku', value: 0 },
      cove_lk: { type: 'shaku_edge_scaled', zone: 'lk', edge: 'long', scale: 0.2 },
      ac_m: { type: 'short_shaku_zone', zone: 'master', edge: 'short' },
      curtain_m: { type: 'fixed_shaku', value: 3 },
      wardrobe_m: { type: 'short_shaku_scaled', zone: 'master', edge: 'short', scale: 0.6 },
      top_m: { type: 'shaku_edge_scaled', zone: 'master', edge: 'long', scale: 0.15 },
      feature_m: { type: 'shaku_edge_scaled', zone: 'master', edge: 'long', scale: 0.25 },
      cove_m: { type: 'shaku_edge_scaled', zone: 'master', edge: 'long', scale: 0.15 },
      desk_m: { type: 'fixed_shaku', value: 0 },
      ac_sec: { type: 'short_shaku_zone', edge: 'short' },
      curtain_sec: { type: 'fixed_shaku', value: 2 },
      wardrobe_sec: { type: 'short_shaku_scaled', edge: 'short', scale: 0.5 },
      top_sec: { type: 'shaku_edge_scaled', edge: 'long', scale: 0.12 },
      feature_sec: { type: 'shaku_edge_scaled', edge: 'long', scale: 0.2 },
      cove_sec: { type: 'shaku_edge_scaled', edge: 'long', scale: 0.1 },
      desk_sec: { type: 'fixed_shaku', value: 0 },
      paint_ceil: { type: 'sum_ping_paints' },
      paint_ac: { type: 'sum_ac_shaku_paint' },
      mep_switches: { type: 'mep_sockets_bed' },
      mep_dedicated: { type: 'fixed_shaku', value: 1 },
      mep_net: { type: 'fixed_shaku', value: 1 },
      mep_tv: { type: 'fixed_shaku', value: 1 },
      mep_misc: { type: 'fixed_shaku', value: 0 },
      mep_recess: { type: 'recess_15x' },
      trim_molding: { type: 'trim_placeholder' },
      touchup_clean: { type: 'touchup_from_settings' },
      wardrobe2: { type: 'avg_secondary_short_shaku_scaled', scale: 0.5 },
      protect_site: { type: 'fixed_shaku', value: 1 },
    };
  }
  function defaultSchemeMenus() {
    var a = defaultSchemeRulesBase();
    var b = cloneR(a);
    b.wardrobe_m = { type: 'short_shaku_full', zone: 'master', edge: 'short' };
    b.wardrobe_sec = { type: 'short_shaku_full', edge: 'short' };
    b.shoe_lk.value = 4;
    b.storage_40.value = 8;
    b.mep_switches = { type: 'mep_sockets_bed' };
    b.mep_dedicated = { type: 'fixed_shaku', value: 2 };
    var c = cloneR(b);
    c.wardrobe_m = { type: 'short_shaku_scaled', zone: 'master', scale: 1.05, edge: 'short' };
    c.wardrobe_sec = { type: 'short_shaku_scaled', scale: 1, edge: 'short' };
    c.tv_wall.scale = 0.5;
    return [
      { id: 'simple', name: '精簡方案', rules: a },
      { id: 'storage', name: '收納導向', rules: b },
      { id: 'design', name: '造型導向', rules: c },
    ];
  }

  /** 與 GitHub `SPEC/~添心設計標準計價表.xlsx` 對價：分頁名＝工作表名稱，品項＝該頁 A 欄全字（讀入時再比對）。 */
  var PRICE_TAB_WOOD = '木作工程';
  var PRICE_TAB_PAINT = '油漆工程';
  var PRICE_TAB_MEP = '水電工程';
  var PRICE_TAB_WALLPAPER = '壁紙工程';
  var PRICE_TAB_PROTECT = '保護工程';

  /**
   * PRICE_SHEET_GAP_NOTES — 表內「找不到同名」或僅能近似代入者（其餘列已盡量對到 A 欄全名）：
   * - 木作+系統收邊：表無整單「收邊％」列；程式小計仍＝木作×％。參考單價欄暫對「壁紙工程｜300CM內鋁製收邊條」。
   * - 細清＋竣工後修補：表無同一併列；程式金額仍＝管理員定額。參考單價欄暫對「油漆工程｜細清後局部髒污修補」。
   * - 餐櫃(深60)：無「餐櫃」→「木作工程｜開門中高櫃-D60H180內」（可改半腰櫃列）。
   * - 沙發背牆：無同名列→「木作工程｜半腰背牆-木紋板-單面」。
   * - 衣櫃置頂：無「置頂」→「木作工程｜木作-封板/美背H61-120cm(油漆面)」。
   * - 化粧桌／書桌：表無「式」專列→「木作工程｜書桌&電視吊櫃-D60XH40內」（延尺）。
   * - 電器櫃：無延尺專列→「木作工程｜電器拉盤」（組）。
   * - 高身櫃：與衣櫃同規格列→「開門高衣櫃-D60H240內」。
   * - 有線電視／路：無「路」→「水電工程｜一孔電視」（組）；可改「電視(端末)」。
   * - 其餘水電：無總括「雜項」→請在水電分頁自選對列；保護工程另列 protect_site。
   * - 出線／插座參考：表為「座／處」計價，與工具「式」語意不同時請手調或改列。
   */

  var DEFAULTS = {
    adminPin: '0426',
    schemaVersion: SCHEMA_V,
    priceSheetGvizId: '',
    priceSheetGid: '',
    priceSheetAutoOnOpen: true,
    knownPriceTabs: ['木作工程', '油漆工程', '水電工程', '壁紙工程', '保護工程'],
    knownPriceItems: {},   /* { tabName: ['品項A', '品項B', ...] } — 從 gviz 讀入後自動填充 */
    floorWaste: 1.15,
    floorRound: 'int',
    trimMoldingRate: 0.05,
    touchupLump: 20000,
    mepSocketBase: 30,
    mepPerZone: 6,
    balconyPing: 2,
    bathroomPings: [1, 1.5],
    lkShareMin: 0.5,
    lkShareMax: 0.6,
    masterVsBed2: 1.3,
    bed3VsBed2: 0.85,
    bed4VsBed2: 0.92,
    rectLong: 6,
    rectShort: 4,
    schemeMenus: defaultSchemeMenus(),
    itemDefs: [
      { id: 'ceiling', zoneScope: 'all', menuBand: 'wood_full', sortKey: 1, group: '全室', groupTitle: '全室木作', quoteSection: '全室木作', displayRank: 200, menuMatrix: '變量・坪(客+臥合，進位) | 不設%', label: '木作平釘天花', unit: '坪', price: 3400, defaultOn: true, cabWood: true, hint: '變量｜客+臥坪合、進位', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '木作平釘天花板', clientNote: '' },
      { id: 'shoe_lk', zoneScope: 'lk', menuBand: 'zone_lk', sortKey: 12, group: '客', groupTitle: '客餐廳', quoteSection: '客餐廳', displayRank: 10, menuMatrix: '定量or變量・可設固定尺(定量) 或 邊尺×%(變量) ・ 長/短邊 ・ 空間=客餐廳', label: '鞋櫃', unit: '尺', price: 2500, defaultOn: true, cabWood: true, hint: '木作', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '開門高櫃-D40H240內', clientNote: '標準計價表：D40×H240 櫃體（與表列「開門高櫃-D40H240內」對價）。' },
      { id: 'storage_40', zoneScope: 'lk', menuBand: 'zone_lk', sortKey: 14, group: '客', groupTitle: '客餐廳', quoteSection: '客餐廳', displayRank: 12, menuMatrix: '同鞋櫃欄位模型・深 40cm', label: '收納櫃(深 40cm)', unit: '尺', price: 2800, defaultOn: true, cabWood: true, hint: '系統/木作櫃', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '開門高櫃-D40H240內', clientNote: '與鞋櫃同：D40×H240 櫃體，對價「開門高櫃-D40H240內」。' },
      { id: 'sideboard_60', zoneScope: 'lk', menuBand: 'zone_lk', sortKey: 16, group: '客', groupTitle: '客餐廳', quoteSection: '客餐廳', displayRank: 14, menuMatrix: '同鞋櫃欄位模型・深 60cm', label: '餐櫃(深 60cm)', unit: '尺', price: 3200, defaultOn: false, cabWood: true, hint: '', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '開門中高櫃-D60H180內', clientNote: '表內無「餐櫃」：暫對 D60 中高櫃列；若實務為半腰可改「開門半腰深櫃-D60H120內」。' },
      { id: 'tv_wall', zoneScope: 'lk', menuBand: 'zone_lk', sortKey: 18, group: '客', groupTitle: '客餐廳', quoteSection: '客餐廳', displayRank: 16, menuMatrix: '變量・邊台尺×% ・ 長/短邊 ・ 客', label: '電視牆', unit: '尺', price: 5000, defaultOn: true, cabWood: true, hint: '', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '電視牆壁板', clientNote: '' },
      { id: 'sofa_wall', zoneScope: 'lk', menuBand: 'zone_lk', sortKey: 20, group: '客', groupTitle: '客餐廳', quoteSection: '客餐廳', displayRank: 18, menuMatrix: '變量・邊台尺×% ・ 長/短邊 ・ 客', label: '沙發背牆', unit: '尺', price: 4000, defaultOn: true, cabWood: true, hint: '', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '半腰背牆-木紋板-單面', clientNote: '表內無「沙發背牆」：暫對半腰背牆單面；可改。' },
      { id: 'ac_lk', zoneScope: 'lk', menuBand: 'zone_lk', sortKey: 22, group: '客', groupTitle: '客餐廳', quoteSection: '客餐廳', displayRank: 20, menuMatrix: '變量・一邊邊滿台尺(短邊預設) ・ 客', label: '冷氣包管', unit: '尺', price: 800, defaultOn: true, cabWood: true, hint: '木作封板', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '矽酸鈣板冷氣包管', clientNote: '' },
      { id: 'curtain_lk', zoneScope: 'lk', menuBand: 'zone_lk', sortKey: 24, group: '客', groupTitle: '客餐廳', quoteSection: '客餐廳', displayRank: 22, menuMatrix: '定量(尺) or 變量', label: '窗簾盒', unit: '尺', price: 1000, defaultOn: true, cabWood: true, hint: '', priceSheetTab: PRICE_TAB_PAINT, priceSheetItem: '油漆-窗簾盒', clientNote: '木作表另有「矽酸鈣板冷氣包管+窗簾盒」合列；此列對油漆之「油漆-窗簾盒」（單位以表為準）。' },
      { id: 'service_hatch', zoneScope: 'lk', menuBand: 'zone_lk', sortKey: 25, group: '客', groupTitle: '客餐廳', quoteSection: '客餐廳', displayRank: 24, menuMatrix: '定量(式)', label: '維修孔', unit: '式', price: 1200, defaultOn: false, cabWood: true, hint: '', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '天花板維修孔', clientNote: '' },
      { id: 'appliance_lk', zoneScope: 'lk', menuBand: 'zone_lk', sortKey: 26, group: '客', groupTitle: '客餐廳', quoteSection: '客餐廳', displayRank: 26, menuMatrix: '定量 or 變量・邊尺×% ・ 客', label: '電器櫃', unit: '尺', price: 3000, defaultOn: true, cabWood: true, hint: '', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '電器拉盤', clientNote: '表列為「電器拉盤」組價；若改延尺櫃體請改表內品項。' },
      { id: 'tall_cab', zoneScope: 'lk', menuBand: 'zone_lk', sortKey: 27, group: '客', groupTitle: '客餐廳', quoteSection: '客餐廳', displayRank: 28, menuMatrix: '定量(尺) or 變量 ・ 客', label: '高身櫃', unit: '尺', price: 3000, defaultOn: false, cabWood: true, hint: '', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '開門高衣櫃-D60H240內', clientNote: '對價 D60×H240 高櫃列；與主臥衣櫃可同列。' },
      { id: 'cove_lk', zoneScope: 'lk', menuBand: 'zone_lk', sortKey: 28, group: '客', groupTitle: '客餐廳', quoteSection: '客餐廳', displayRank: 30, menuMatrix: '變量・邊台尺×% ・ 長/短邊 ・ 客', label: '間接照明(間照)', unit: '尺', price: 1800, defaultOn: true, cabWood: true, hint: '', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '間接照明', clientNote: '' },
      { id: 'floor_p', perFloor: true, menuBand: 'floor', sortKey: 10, group: '地板', groupTitle: '地板', quoteSection: '地板', displayRank: 210, menuMatrix: '變量・各空間實鋪×損耗%再取整（一條規則套各區；明細列在該空間末）', label: '地坪(耐磨／實鋪×損耗＋取整)', unit: '坪', price: 4500, defaultOn: true, cabWood: false, hint: '備註僅供參考；實務常扣除櫃下不鋪範圍，以現場／圖面為準', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: "Hent's 8mm超耐磨木地板", clientNote: '備註僅供參考。實務地坪多會扣除櫃体下方不鋪區，本工具仍用空間實鋪坪×損耗試算，請與設計師確認圖面。地坪列在「木作工程」分頁下方；可改對 QS 等系列列。' },
      { id: 'ac_m', zoneScope: 'master', menuBand: 'zone_master', sortKey: 32, group: '主臥', groupTitle: '主臥', quoteSection: '主臥', displayRank: 40, menuMatrix: '變量・一邊台尺 ・ 主臥', label: '冷氣包管', unit: '尺', price: 800, defaultOn: true, cabWood: true, hint: '', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '矽酸鈣板冷氣包管', clientNote: '' },
      { id: 'curtain_m', zoneScope: 'master', menuBand: 'zone_master', sortKey: 33, group: '主臥', groupTitle: '主臥', quoteSection: '主臥', displayRank: 42, menuMatrix: '定量(尺) or 變量 ・ 主臥', label: '窗簾盒', unit: '尺', price: 1000, defaultOn: true, cabWood: true, hint: '', priceSheetTab: PRICE_TAB_PAINT, priceSheetItem: '油漆-窗簾盒', clientNote: '' },
      { id: 'wardrobe_m', zoneScope: 'master', menuBand: 'zone_master', sortKey: 34, group: '主臥', groupTitle: '主臥', quoteSection: '主臥', displayRank: 44, menuMatrix: '變量・邊滿或邊尺×% ・ 主臥短邊預設', label: '衣櫃', unit: '尺', price: 3500, defaultOn: true, cabWood: true, hint: '', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '開門高衣櫃-D60H240內', clientNote: '標準計價表：D60×H240 櫃體（「開門高衣櫃-D60H240內」）。' },
      { id: 'top_m', zoneScope: 'master', menuBand: 'zone_master', sortKey: 35, group: '主臥', groupTitle: '主臥', quoteSection: '主臥', displayRank: 46, menuMatrix: '變量・邊台尺×% ・ 主', label: '衣櫃置頂', unit: '尺', price: 2000, defaultOn: true, cabWood: true, hint: '', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '木作-封板/美背H61-120cm(油漆面)', clientNote: '表內無「置頂」專列：暫對封板／美背延尺列；可改。' },
      { id: 'feature_m', zoneScope: 'master', menuBand: 'zone_master', sortKey: 36, group: '主臥', groupTitle: '主臥', quoteSection: '主臥', displayRank: 48, menuMatrix: '變量・邊台尺×% ・ 長/短 ・ 主臥', label: '造型背牆或半腰背牆', unit: '尺', price: 4200, defaultOn: true, cabWood: true, hint: '', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '半腰背牆-木紋板-單面', clientNote: '' },
      { id: 'cove_m', zoneScope: 'master', menuBand: 'zone_master', sortKey: 37, group: '主臥', groupTitle: '主臥', quoteSection: '主臥', displayRank: 50, menuMatrix: '變量・邊台尺×% ・ 主', label: '間接照明(間照)', unit: '尺', price: 1800, defaultOn: true, cabWood: true, hint: '', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '間接照明', clientNote: '' },
      { id: 'desk_m', zoneScope: 'master', menuBand: 'zone_master', sortKey: 38, group: '主臥', groupTitle: '主臥', quoteSection: '主臥', displayRank: 52, menuMatrix: '定量(式) ・ 主臥', label: '化粧桌／書桌', unit: '式', price: 12000, defaultOn: false, cabWood: true, hint: '', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '書桌&電視吊櫃-D60XH40內', clientNote: '表內為延尺單價列；與「式」不同時請改表內品項或手改單價。' },
      { id: 'ac_sec', perSecondary: true, menuBand: 'zone_bed', sortKey: 51, group: '次臥', groupTitle: '次臥', label: '冷氣包管', quoteSection: '次臥', displayRank: 40, menuMatrix: '變量・一邊台尺 ・ 次臥各間(規則不帶臥名)', unit: '尺', price: 800, defaultOn: true, cabWood: true, hint: '逐間', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '矽酸鈣板冷氣包管', clientNote: '' },
      { id: 'curtain_sec', perSecondary: true, menuBand: 'zone_bed', sortKey: 52, group: '次臥', groupTitle: '次臥', label: '窗簾盒', quoteSection: '次臥', displayRank: 42, menuMatrix: '定量 or 變量 ・ 次臥各間', unit: '尺', price: 1000, defaultOn: true, cabWood: true, hint: '', priceSheetTab: PRICE_TAB_PAINT, priceSheetItem: '油漆-窗簾盒', clientNote: '' },
      { id: 'wardrobe_sec', perSecondary: true, menuBand: 'zone_bed', sortKey: 53, group: '次臥', groupTitle: '次臥', label: '衣櫃', quoteSection: '次臥', displayRank: 44, menuMatrix: '變量・邊滿/邊尺×% ・ 次臥各間', unit: '尺', price: 3200, defaultOn: true, cabWood: true, hint: '', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '開門高衣櫃-D60H240內', clientNote: '標準計價表：D60×H240 櫃體（「開門高衣櫃-D60H240內」）。' },
      { id: 'top_sec', perSecondary: true, menuBand: 'zone_bed', sortKey: 54, group: '次臥', groupTitle: '次臥', label: '衣櫃置頂', quoteSection: '次臥', displayRank: 46, menuMatrix: '變量・邊台尺×% ・ 次臥', unit: '尺', price: 2000, defaultOn: true, cabWood: true, hint: '', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '木作-封板/美背H61-120cm(油漆面)', clientNote: '同主臥置頂：暫對封板／美背列。' },
      { id: 'feature_sec', perSecondary: true, menuBand: 'zone_bed', sortKey: 55, group: '次臥', groupTitle: '次臥', label: '造型背牆或半腰背牆', quoteSection: '次臥', displayRank: 48, menuMatrix: '變量・邊台尺×% ・ 次臥各間', unit: '尺', price: 4000, defaultOn: true, cabWood: true, hint: '', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '半腰背牆-木紋板-單面', clientNote: '' },
      { id: 'cove_sec', perSecondary: true, menuBand: 'zone_bed', sortKey: 56, group: '次臥', groupTitle: '次臥', label: '間接照明(間照)', quoteSection: '次臥', displayRank: 50, menuMatrix: '變量・邊台尺×% ・ 次臥', unit: '尺', price: 1800, defaultOn: true, cabWood: true, hint: '', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '間接照明', clientNote: '' },
      { id: 'desk_sec', perSecondary: true, menuBand: 'zone_bed', sortKey: 57, group: '次臥', groupTitle: '次臥', label: '化粧桌／書桌', quoteSection: '次臥', displayRank: 52, menuMatrix: '定量(式) ・ 次臥各間', unit: '式', price: 10000, defaultOn: false, cabWood: true, hint: '', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '書桌&電視吊櫃-D60XH40內', clientNote: '同主臥書桌列。' },
      { id: 'wardrobe2', zoneScope: 'all', menuBand: 'wood_full', sortKey: 2, group: '全室', groupTitle: '全室木作', quoteSection: '全室木作', displayRank: 215, menuMatrix: '次臥平均尺×%（舊合併列、少用）', label: '衣櫃(次臥短邊平均-舊)', unit: '尺', price: 3200, perSecondary: false, defaultOn: false, cabWood: false, hint: '併舊方案用', priceSheetTab: PRICE_TAB_WOOD, priceSheetItem: '開門高衣櫃-D60H240內', clientNote: '舊合併列：單價對照同主／次臥衣櫃 D60×H240。' },
      { id: 'paint_ceil', zoneScope: 'all', menuBand: 'paint', sortKey: 200, group: '油漆', groupTitle: '油漆工程', quoteSection: '油漆工程', displayRank: 220, menuMatrix: '變量・坪(面漆參考) | 不設邊', label: '面漆(天地壁-概估用坪)', unit: '坪', price: 600, defaultOn: true, cabWood: false, hint: '概估＝客+臥實鋪坪', priceSheetTab: PRICE_TAB_PAINT, priceSheetItem: '矽酸鈣/石膏天花板-乳膠漆', clientNote: '概估面漆：暫對天花乳膠漆列；可改牆面或水泥漆列。' },
      { id: 'paint_ac', zoneScope: 'all', menuBand: 'paint', sortKey: 201, group: '油漆', groupTitle: '油漆工程', quoteSection: '油漆工程', displayRank: 230, menuMatrix: '變量・全區包管短邊合計台尺', label: '矽鈣／包管油漆(參考台尺合)', unit: '尺', price: 200, defaultOn: true, cabWood: false, hint: '各空間包管一邊短尺加總', priceSheetTab: PRICE_TAB_PAINT, priceSheetItem: '油漆-冷氣包管', clientNote: '' },
      { id: 'mep_switches', zoneScope: 'all', menuBand: 'mep', sortKey: 300, group: '水電', groupTitle: '水電工程', quoteSection: '水電工程', displayRank: 300, menuMatrix: '變量・點數(底+臥，管理員) | 全區', label: '出線/開關插座(參考-點)', unit: '式', price: 350, defaultOn: true, cabWood: false, hint: '底數+每區一參與', priceSheetTab: PRICE_TAB_MEP, priceSheetItem: '插座拉線新增/移位-一般作法', clientNote: '參考用「座」價；本工具數量語意為式／點時請手調或改對列。' },
      { id: 'mep_dedicated', zoneScope: 'all', menuBand: 'mep', sortKey: 301, group: '水電', groupTitle: '水電工程', quoteSection: '水電工程', displayRank: 302, menuMatrix: '定量(迴)', label: '專用迴路/220V(參考)', unit: '迴', price: 5000, defaultOn: true, cabWood: false, hint: '', priceSheetTab: PRICE_TAB_MEP, priceSheetItem: '新增5.5 專用迴路', clientNote: '表列單位為「處」；讀入後單位會以表為準。' },
      { id: 'mep_net', zoneScope: 'all', menuBand: 'mep', sortKey: 302, group: '水電', groupTitle: '水電工程', quoteSection: '水電工程', displayRank: 304, menuMatrix: '定量(點)', label: '網路/弱電延伸(參考)', unit: '點', price: 1500, defaultOn: true, cabWood: false, hint: '', priceSheetTab: PRICE_TAB_MEP, priceSheetItem: '網路線拉線/延長 +資訊座(延長工法)', clientNote: '' },
      { id: 'mep_tv', zoneScope: 'all', menuBand: 'mep', sortKey: 303, group: '水電', groupTitle: '水電工程', quoteSection: '水電工程', displayRank: 306, menuMatrix: '定量(路)', label: '有線電視/同軸(參考)', unit: '路', price: 1500, defaultOn: true, cabWood: false, hint: '', priceSheetTab: PRICE_TAB_MEP, priceSheetItem: '一孔電視', clientNote: '表無「路／同軸」專列：暫對「一孔電視」（組）；可改「電視(端末)」。' },
      { id: 'mep_misc', zoneScope: 'all', menuBand: 'mep', sortKey: 304, group: '水電', groupTitle: '水電工程', quoteSection: '水電工程', displayRank: 308, menuMatrix: '定量(式)', label: '其餘水電(參考)', unit: '式', price: 3000, defaultOn: false, cabWood: false, hint: '', priceSheetTab: PRICE_TAB_MEP, priceSheetItem: '其他工程配合費', clientNote: '表內無「水電雜項」總列時請改對單項；勿再對到保護工程分頁。' },
      { id: 'mep_recess', zoneScope: 'all', menuBand: 'mep', sortKey: 305, group: '水電', groupTitle: '水電工程', quoteSection: '水電工程', displayRank: 310, menuMatrix: '變量・(客+臥坪)×1.5 盞(概估) | 全區', label: '嵌燈/筒燈(參考-盞)', unit: '盞', price: 500, defaultOn: true, cabWood: false, hint: '概估(客+臥坪）×1.5 盞', priceSheetTab: PRICE_TAB_MEP, priceSheetItem: '9mm嵌燈', clientNote: '' },
      { id: 'protect_site', zoneScope: 'all', menuBand: 'protect', sortKey: 60, group: '保護', groupTitle: '保護工程', quoteSection: '保護工程', displayRank: 60, menuMatrix: '定量(式)', label: '施工期現場保護（參考）', unit: '式', price: 18000, defaultOn: true, cabWood: false, hint: '含走道、電梯口、角保等可併一式或拆列', priceSheetTab: PRICE_TAB_PROTECT, priceSheetItem: '粗步清潔及工具損耗', clientNote: '大樓案常含公設保護；請依表改對「地坪保護」「角保」等實際子目。' },
      { id: 'trim_molding', zoneScope: 'all', menuBand: 'finish', sortKey: 400, group: '收尾', groupTitle: '收邊與細清', quoteSection: '收邊與細清', displayRank: 400, menuMatrix: '佔位(式) ・ 金額=木作小計×% 見管理員', label: '木作+系統收邊(參考)', unit: '式', price: 0, lineKind: 'trim', defaultOn: true, cabWood: false, hint: '小計=下方木作+系統合計×設定%', quoteNote: 'trim', priceSheetTab: PRICE_TAB_WALLPAPER, priceSheetItem: '300CM內鋁製收邊條', clientNote: '表無「收邊％」整單列：報價小計仍依管理員％×木作小計；此欄僅供讀入單價參考（與實際收邊計價方式可能不同）。' },
      { id: 'touchup_clean', zoneScope: 'all', menuBand: 'finish', sortKey: 401, group: '收尾', groupTitle: '收邊與細清', quoteSection: '收邊與細清', displayRank: 410, menuMatrix: '佔位(定額) ・ 金額見管理員', label: '細清＋竣工後修補(參考)', unit: '式', price: 0, lineKind: 'touchup', defaultOn: true, cabWood: false, hint: '參考固定額，見管理員', priceSheetTab: PRICE_TAB_PAINT, priceSheetItem: '細清後局部髒污修補', clientNote: '表無與「定額細清＋竣工修補」完全對應之单列：報價金額仍依管理員定額；此欄對「細清後局部髒污修補」供參考單價。可改「木作後局部髒污損傷修補」。' },
    ],
    templates: [
      { id: '3b2h', name: '三房二廳（3 臥 + 客廚 + 2 衛）', bedrooms: 3, baths: 2 },
      { id: '2b1h', name: '二房一廳一衛（2 臥 + 客廚 + 1 衛）', bedrooms: 2, baths: 1 },
      { id: '4b2h', name: '四房二廳（4 臥 + 客廚 + 2 衛）', bedrooms: 4, baths: 2 },
    ],
  };

  var state = {
    settings: null,
    lastAlloc: null,
    selectedSchemeId: 'simple',
    _preservedMenuScheme: null,
    fbReady: false,
    fbAuthUid: null,
    fbLoadNote: '',
  };
  var priceSyncPromise = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /** 供 HTML 屬性 value 等使用（含引號） */
  function escAttr(s) {
    return esc(s).replace(/"/g, '&quot;');
  }
