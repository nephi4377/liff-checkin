/**
 * 窗簾估價 — 尺寸推算與金額計算
 */
(function (global) {
  'use strict';

  var CFG = global.CQ_CONFIG;

  function num(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  function roundMoney(n) {
    return Math.round(n);
  }

  function ceilShaku(cm) {
    return Math.max(1, Math.ceil(cm / CFG.SHAKU_CM));
  }

  function trackShakuFromWidth(widthCm) {
    return Math.max(1, Math.ceil(widthCm / CFG.TRACK_SHAKU_CM));
  }

  function ceilCai(widthCm, heightCm) {
    var area = widthCm * heightCm;
    var unit = CFG.CAI_SIDE_CM * CFG.CAI_SIDE_CM;
    return Math.max(1, Math.ceil(area / unit));
  }

  function computeCaiOnlyQuantity(w, h, type) {
    var minH = type.minHeightCm || 120;
    var effectiveH = Math.max(h, minH);
    var raw = (w * effectiveH) / 900;
    var minCai = type.minFabricCai || 20;
    return Math.max(minCai, raw);
  }

  /** 布簾類試算表公式 §3.3.1 */
  function computeFabricPanelMa(win, type, w, h) {
    var rules = CFG.FABRIC_PANEL_RULES;
    var panels = CFG.computePanelCount(w, type.fullnessRatio || 2, rules.fabricRollWidthCm);
    var maHeight = (h + rules.topAllowanceCm + rules.bottomAllowanceCm) / rules.maLengthDivisor;
    var fabricPrice = num(win.fabricPricePerCai) || type.defaultFabricPrice;
    var factor = type.fabricMaFactor || 0.55;
    var fabricSub = Math.floor(panels * maHeight * fabricPrice * factor);
    var trackShaku = trackShakuFromWidth(w);
    var trackSub = trackShaku * rules.trackPricePerShaku;
    var sewingSub = panels * rules.sewingPerPanel;

    return {
      panels: panels,
      maHeight: maHeight,
      fabricSub: fabricSub,
      fabricPrice: fabricPrice,
      fabricFactor: factor,
      trackShaku: trackShaku,
      trackSub: trackSub,
      sewingSub: sewingSub
    };
  }

  function computeWindow(win) {
    var type = CFG.getTypeById(win.curtainTypeId);
    var w = num(win.openingWidthCm);
    var h = num(win.openingHeightCm);
    var warnings = [];

    if (w <= 0 || h <= 0) {
      return {
        valid: false,
        warnings: ['請輸入大於 0 的寬度與高度（公分）。'],
        lineItems: [],
        lineTotal: 0,
        computedTrackShaku: 0,
        computedFabricCai: 0,
        computedPanels: 0,
        orderSpecs: CFG.formatOrderSpecs(win)
      };
    }

    if (w < 30 || w > 600) warnings.push('寬度超出常見範圍（30–600 cm），請確認。');
    if (h < 30 || h > 350) warnings.push('高度超出常見範圍（30–350 cm），請確認。');

    var lineItems = [];
    var fabricSub = 0;
    var trackSub = 0;
    var sewingSub = 0;
    var trackShaku = 0;
    var fabricCai = 0;
    var panels = 0;

    if (type.pricingMode === 'fabric_panel_ma') {
      var fp = computeFabricPanelMa(win, type, w, h);
      panels = fp.panels;
      trackShaku = fp.trackShaku;
      fabricSub = fp.fabricSub;

      lineItems.push({
        key: 'fabric',
        label: type.label + '布料',
        detail: fp.panels + ' 幅 × 布高 ' + Math.round(h + CFG.FABRIC_PANEL_RULES.topAllowanceCm + CFG.FABRIC_PANEL_RULES.bottomAllowanceCm) + ' cm（含余量）· 係數 ' + fp.fabricFactor,
        qty: Math.round(fp.maHeight * fp.panels * 100) / 100,
        unit: '碼',
        unitPrice: fp.fabricPrice,
        subtotal: fabricSub
      });

      if (win.includeTrack !== false) {
        trackSub = fp.trackSub;
        lineItems.push({
          key: 'track',
          label: '軌道' + (win.trackType === 'curved' ? '（彎軌）' : ''),
          detail: '窗寬 ' + Math.round(w) + ' cm',
          qty: fp.trackShaku,
          unit: '尺',
          unitPrice: CFG.FABRIC_PANEL_RULES.trackPricePerShaku,
          subtotal: trackSub
        });
      }

      if (win.includeSewing !== false) {
        sewingSub = fp.sewingSub;
        lineItems.push({
          key: 'sewing',
          label: '車工',
          detail: fp.panels + ' 幅',
          qty: fp.panels,
          unit: '幅',
          unitPrice: CFG.FABRIC_PANEL_RULES.sewingPerPanel,
          subtotal: sewingSub
        });
      }
    } else {
      var rules = CFG.DEFAULT_DIM_RULES;
      var fabricWidthCm = w * (type.fullnessRatio || 1);
      var fabricHeightCm = h + rules.topAllowanceCm + rules.bottomAllowanceFloorCm;
      fabricCai = computeCaiOnlyQuantity(w, h, type);
      var fabricPrice = num(win.fabricPricePerCai) || type.defaultFabricPrice;
      var fabricFactor = type.fabricCaiFactor || 1;
      fabricSub = roundMoney(fabricCai * fabricPrice * fabricFactor);
      lineItems.push({
        key: 'fabric',
        label: type.label + '布料',
        detail: '約 ' + fabricCai + ' 才（含基本才 ' + (type.minFabricCai || 20) + '）· 開口 ' + Math.round(w) + '×' + Math.round(h) + ' cm',
        qty: fabricCai,
        unit: '才',
        unitPrice: roundMoney(fabricPrice * fabricFactor),
        subtotal: fabricSub
      });
    }

    var installSub = 0;
    if (win.includeInstall !== false) {
      var installFee = CFG.computeInstallFee(w, type, win);
      if (installFee > 0) {
        var installDetail = type.pricingMode === 'fabric_panel_ma'
          ? '試算表公式 · 窗寬 ' + Math.round(w) + ' cm'
          : (CFG.INSTALL_RULES.tiers[type.installTier] || CFG.INSTALL_RULES.tiers.general).label + ' · 寬 ' + ceilShaku(w) + ' 尺';
        installSub = installFee;
        lineItems.push({
          key: 'install',
          label: '安裝費',
          detail: installDetail,
          qty: 1,
          unit: '式',
          unitPrice: installFee,
          subtotal: installSub
        });
      }
      if (win.trackType === 'curved' && type.pricingMode === 'fabric_panel_ma') {
        var curvedLump = CFG.INSTALL_RULES.curvedTrackLump;
        lineItems.push({
          key: 'curved_install',
          label: '彎軌安裝',
          detail: '師傅請款參考',
          qty: 1,
          unit: '式',
          unitPrice: curvedLump,
          subtotal: curvedLump
        });
        installSub += curvedLump;
      }
    }

    var lineTotal = fabricSub + trackSub + sewingSub + installSub;
    var orderSpecs = CFG.formatOrderSpecs(win);

    return {
      valid: true,
      warnings: warnings,
      typeLabel: type.label,
      brandModel: win.brandModel || '',
      orderSpecs: orderSpecs,
      pricingMode: type.pricingMode,
      computedTrackShaku: trackShaku,
      computedFabricCai: fabricCai,
      computedPanels: panels,
      lineItems: lineItems,
      lineTotal: lineTotal
    };
  }

  function computeQuote(state) {
    var results = [];
    var grandTotal = 0;
    var hasValid = false;

    (state.windows || []).forEach(function (win) {
      var r = computeWindow(win);
      r.windowId = win.id;
      r.roomLabel = win.roomLabel || '（未命名空間）';
      r.openingSize = num(win.openingWidthCm) + ' × ' + num(win.openingHeightCm) + ' cm';
      r.clientNote = win.clientNote || '';
      results.push(r);
      if (r.valid) {
        hasValid = true;
        grandTotal += r.lineTotal;
      }
    });

    return {
      windows: results,
      grandTotal: grandTotal,
      hasValid: hasValid,
      generatedAt: new Date().toISOString()
    };
  }

  global.CQ_CALC = {
    computeWindow: computeWindow,
    computeQuote: computeQuote,
    computeFabricPanelMa: computeFabricPanelMa,
    ceilShaku: ceilShaku,
    ceilCai: ceilCai
  };
})(typeof window !== 'undefined' ? window : globalThis);
