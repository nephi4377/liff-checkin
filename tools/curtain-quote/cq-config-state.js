/**
 * 窗簾估價 — 常數、種類、下單規格、安裝費規則
 */
(function (global) {
  'use strict';

  var SHAKU_CM = 30.3;
  var CAI_SIDE_CM = 30.3;
  var TRACK_SHAKU_CM = 30;

  var DEFAULT_DIM_RULES = {
    trackExtendEachSideCm: 15,
    topAllowanceCm: 15,
    bottomAllowanceFloorCm: 10,
    bottomAllowanceSillCm: 0
  };

  /** 布簾類試算表參數（§3.3.1） */
  var FABRIC_PANEL_RULES = {
    fabricRollWidthCm: 150,
    topAllowanceCm: 30,
    bottomAllowanceCm: 15,
    maLengthDivisor: 90,
    trackPricePerShaku: 40,
    sewingPerPanel: 200
  };

  var INSTALL_RULES = {
    baseShakuIncluded: 5,
    perExtraShaku: 50,
    curvedTrackLump: 450,
    tiers: {
      general: { label: '一般', baseFee: 200 },
      wave: { label: 'S 形', baseFee: 250 },
      dimming: { label: '調光', baseFee: 200 }
    }
  };

  var OPEN_STYLES = [
    { id: 'single', label: '單開' },
    { id: 'double', label: '雙開（對開）' }
  ];

  var PULL_DIRECTIONS = [
    { id: 'left', label: '左拉' },
    { id: 'right', label: '右拉' },
    { id: 'both', label: '雙向' }
  ];

  var LAYER_COUNTS = [
    { id: 'single', label: '單層' },
    { id: 'double', label: '雙層（布＋紗）' }
  ];

  var TRACK_TYPES = [
    { id: 'straight', label: '直軌' },
    { id: 'curved', label: '彎軌' }
  ];

  var TYPE_ORDER_FIELDS = {
    fabric_drape: ['openStyle', 'pullDirection', 'layerCount', 'trackType'],
    fabric_sheer: ['openStyle', 'pullDirection', 'layerCount', 'trackType'],
    fabric_sheer_light: ['openStyle', 'pullDirection', 'layerCount', 'trackType'],
    fabric_wave: ['openStyle', 'pullDirection', 'layerCount', 'trackType'],
    fabric_roller: ['pullDirection'],
    blind_dimming: ['pullDirection'],
    fabric_roman: ['pullDirection'],
    blind_cellular: [],
    blind_venetian: []
  };

  var CURTAIN_TYPES = [
    {
      id: 'fabric_drape',
      label: '布簾',
      category: '布簾／紗簾類',
      pricingMode: 'fabric_panel_ma',
      fullnessRatio: 2.0,
      fabricMaFactor: 0.55,
      defaultFabricPrice: 860,
      installTier: 'general',
      measureHint: '布料單價為元／碼，每窗輸入；含車工。'
    },
    {
      id: 'fabric_sheer',
      label: '紗簾',
      category: '布簾／紗簾類',
      pricingMode: 'fabric_panel_ma',
      fullnessRatio: 2.0,
      fabricMaFactor: 0.55,
      defaultFabricPrice: 650,
      installTier: 'general',
      measureHint: '同布簾計價；可與布簾分軌或同軌雙層。'
    },
    {
      id: 'fabric_sheer_light',
      label: '穿透簾',
      category: '布簾／紗簾類',
      pricingMode: 'fabric_panel_ma',
      fullnessRatio: 2.0,
      fabricMaFactor: 0.55,
      defaultFabricPrice: 700,
      installTier: 'general',
      measureHint: '量法同紗簾。'
    },
    {
      id: 'fabric_wave',
      label: '蛇行簾',
      category: '布簾／紗簾類',
      pricingMode: 'fabric_panel_ma',
      fullnessRatio: 3.0,
      fabricMaFactor: 0.65,
      defaultFabricPrice: 650,
      installTier: 'wave',
      measureHint: '布幅倍率 3；布料係數 0.65。'
    },
    {
      id: 'fabric_roller',
      label: '捲簾',
      category: '捲簾／調光類',
      pricingMode: 'cai_only',
      fullnessRatio: 1.0,
      minFabricCai: 20,
      fabricCaiFactor: 0.6,
      minHeightCm: 120,
      defaultFabricPrice: 240,
      installTier: 'general',
      measureHint: '布料單價為元／才，每窗輸入。'
    },
    {
      id: 'blind_dimming',
      label: '調光簾',
      category: '捲簾／調光類',
      pricingMode: 'cai_only',
      fullnessRatio: 1.0,
      minFabricCai: 20,
      fabricCaiFactor: 0.6,
      minHeightCm: 120,
      defaultFabricPrice: 330,
      installTier: 'dimming',
      measureHint: '布料單價為元／才，每窗輸入。'
    },
    {
      id: 'fabric_roman',
      label: '羅馬簾',
      category: '捲簾／調光類',
      pricingMode: 'cai_only',
      fullnessRatio: 1.0,
      minFabricCai: 20,
      fabricCaiFactor: 0.6,
      minHeightCm: 120,
      defaultFabricPrice: 260,
      installTier: 'general',
      measureHint: '布料單價為元／才，每窗輸入。'
    },
    {
      id: 'blind_cellular',
      label: '蜂巢簾',
      category: '百葉／蜂巢類',
      pricingMode: 'cai_only',
      fullnessRatio: 1.0,
      minFabricCai: 20,
      fabricCaiFactor: 1.0,
      minHeightCm: 120,
      defaultFabricPrice: 300,
      installTier: 'general',
      measureHint: '布料單價為元／才，每窗輸入。'
    },
    {
      id: 'blind_venetian',
      label: '百葉簾',
      category: '百葉／蜂巢類',
      pricingMode: 'cai_only',
      fullnessRatio: 1.0,
      minFabricCai: 20,
      fabricCaiFactor: 1.0,
      minHeightCm: 120,
      defaultFabricPrice: 280,
      installTier: 'general',
      measureHint: '布料單價為元／才，每窗輸入。'
    }
  ];

  var DEFAULT_DISCLAIMER = [
    '本估價依您自填寬高與系統推算，僅供參考，不構成報價承諾。',
    '實際費用以現場複尺、窗型、選料與安裝難度為準。',
    '布簾類布料以碼價計；安裝費依試算表公式估算。',
    '金額為未稅參考價；定案前請與添心設計師確認。'
  ].join('\n');

  function getTypeById(id) {
    for (var i = 0; i < CURTAIN_TYPES.length; i++) {
      if (CURTAIN_TYPES[i].id === id) return CURTAIN_TYPES[i];
    }
    return CURTAIN_TYPES[0];
  }

  function getOrderFieldsForType(typeId) {
    return TYPE_ORDER_FIELDS[typeId] || [];
  }

  function fabricPriceUnit(type) {
    return type.pricingMode === 'fabric_panel_ma' ? '碼' : '才';
  }

  function labelFromOptions(options, id) {
    for (var i = 0; i < options.length; i++) {
      if (options[i].id === id) return options[i].label;
    }
    return '';
  }

  function formatOrderSpecs(win) {
    var type = getTypeById(win.curtainTypeId);
    var fields = getOrderFieldsForType(type.id);
    var parts = [];
    if (win.brandModel) parts.push(win.brandModel);
    fields.forEach(function (key) {
      if (key === 'openStyle' && win.openStyle) {
        parts.push(labelFromOptions(OPEN_STYLES, win.openStyle));
      }
      if (key === 'pullDirection' && win.pullDirection) {
        parts.push(labelFromOptions(PULL_DIRECTIONS, win.pullDirection));
      }
      if (key === 'layerCount' && win.layerCount === 'double') {
        parts.push('雙層');
      }
      if (key === 'trackType' && win.trackType === 'curved') {
        parts.push('彎軌');
      }
    });
    return parts.filter(Boolean).join(' · ');
  }

  /** 試算表客戶安裝費（§3.3.1 步驟 5） */
  function computeSpreadsheetInstallFee(widthCm) {
    var w = parseFloat(widthCm) || 0;
    if (w <= 0) return 0;
    var extra = w < 150 ? 0 : 50 * Math.ceil((w - 150) / 30);
    return Math.round(400 + extra + 400);
  }

  function computeInstallFee(widthCm, type, win) {
    if (win && win.installFeeOverride != null && win.installFeeOverride !== '') {
      return Math.round(parseFloat(win.installFeeOverride) || 0);
    }
    if (type.pricingMode === 'fabric_panel_ma') {
      return computeSpreadsheetInstallFee(widthCm);
    }
    var rules = INSTALL_RULES;
    var tier = rules.tiers[type.installTier] || rules.tiers.general;
    var w = parseFloat(widthCm) || 0;
    if (w <= 0) return 0;
    var shaku = Math.max(1, Math.ceil(w / SHAKU_CM));
    var extra = Math.max(0, shaku - rules.baseShakuIncluded);
    return Math.round(tier.baseFee + extra * rules.perExtraShaku);
  }

  function computePanelCount(openingWidthCm, fullnessRatio, rollWidthCm) {
    var needWidth = openingWidthCm * fullnessRatio;
    var panels = Math.ceil(needWidth / rollWidthCm);
    if (needWidth % rollWidthCm === 0) panels += 1;
    return panels;
  }

  function createWindow(partial) {
    var type = getTypeById(partial && partial.curtainTypeId);
    var fields = getOrderFieldsForType(type.id);
    return {
      id: (partial && partial.id) || 'win-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      roomLabel: (partial && partial.roomLabel) || '',
      curtainTypeId: type.id,
      brandModel: (partial && partial.brandModel) || '',
      openingWidthCm: partial && partial.openingWidthCm != null ? partial.openingWidthCm : '',
      openingHeightCm: partial && partial.openingHeightCm != null ? partial.openingHeightCm : '',
      openStyle: partial && partial.openStyle ? partial.openStyle : (fields.indexOf('openStyle') >= 0 ? 'double' : ''),
      pullDirection: partial && partial.pullDirection ? partial.pullDirection : (fields.indexOf('pullDirection') >= 0 ? 'left' : ''),
      layerCount: partial && partial.layerCount ? partial.layerCount : 'single',
      trackType: partial && partial.trackType ? partial.trackType : 'straight',
      fabricPricePerCai: partial && partial.fabricPricePerCai != null ? partial.fabricPricePerCai : type.defaultFabricPrice,
      installFeeOverride: partial && partial.installFeeOverride != null ? partial.installFeeOverride : '',
      includeTrack: partial && partial.includeTrack != null ? partial.includeTrack : type.pricingMode === 'fabric_panel_ma',
      includeSewing: partial && partial.includeSewing != null ? partial.includeSewing : type.pricingMode === 'fabric_panel_ma',
      includeInstall: partial && partial.includeInstall != null ? partial.includeInstall : true,
      clientNote: (partial && partial.clientNote) || ''
    };
  }

  function createDefaultState() {
    return {
      quoteTitle: '',
      customerName: '',
      priceBookVersionDate: '2025-01-04',
      globalFabricPrice: '',
      windows: [createWindow({ roomLabel: '客廳' })]
    };
  }

  global.CQ_CONFIG = {
    SHAKU_CM: SHAKU_CM,
    CAI_SIDE_CM: CAI_SIDE_CM,
    TRACK_SHAKU_CM: TRACK_SHAKU_CM,
    DEFAULT_DIM_RULES: DEFAULT_DIM_RULES,
    FABRIC_PANEL_RULES: FABRIC_PANEL_RULES,
    INSTALL_RULES: INSTALL_RULES,
    OPEN_STYLES: OPEN_STYLES,
    PULL_DIRECTIONS: PULL_DIRECTIONS,
    LAYER_COUNTS: LAYER_COUNTS,
    TRACK_TYPES: TRACK_TYPES,
    CURTAIN_TYPES: CURTAIN_TYPES,
    DEFAULT_DISCLAIMER: DEFAULT_DISCLAIMER,
    getTypeById: getTypeById,
    getOrderFieldsForType: getOrderFieldsForType,
    fabricPriceUnit: fabricPriceUnit,
    formatOrderSpecs: formatOrderSpecs,
    computeInstallFee: computeInstallFee,
    computeSpreadsheetInstallFee: computeSpreadsheetInstallFee,
    computePanelCount: computePanelCount,
    createWindow: createWindow,
    createDefaultState: createDefaultState
  };
})(typeof window !== 'undefined' ? window : globalThis);
