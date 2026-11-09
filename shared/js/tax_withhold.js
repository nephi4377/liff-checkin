/**
 * 薪資所得扣繳＋非固定獎金＋二代健保補充保費（前端試算）
 * 與 Backend CheckinSystem/Logic_TaxWithhold.js 同步（115 年度）。
 * 假資料／試算用；正式扣款以後端為準。
 */
(function (global) {
  'use strict';

  var EXEMPTION = 101000;
  var STANDARD_DED = 272000;
  var SALARY_DED = 227000;
  var EXEMPT_MAX = 2000;
  var NON_MONTHLY_THRESHOLD = 90501;
  var NHI_RATE_NUM = 211;
  var NHI_RATE_DEN = 10000;
  var NHI_MULT = 4;
  var BRACKETS = [
    { min: 0, max: 610000, rateNum: 5, progressiveDiff: 0 },
    { min: 610001, max: 1380000, rateNum: 12, progressiveDiff: 42700 },
    { min: 1380001, max: 2770000, rateNum: 20, progressiveDiff: 153100 },
    { min: 2770001, max: 5190000, rateNum: 30, progressiveDiff: 430100 },
    { min: 5190001, max: null, rateNum: 40, progressiveDiff: 949100 }
  ];

  function roundHalfUpDiv(num, den) {
    if (den <= 0) return 0;
    return Math.floor((num * 2 + den) / (den * 2));
  }

  function floorToTens(n) {
    var v = Math.floor(Number(n) || 0);
    if (v <= 0) return 0;
    return Math.floor(v / 10) * 10;
  }

  function normalizeMode(raw) {
    var s = String(raw || '').trim().toLowerCase().replace(/\s/g, '');
    if (!s) return 'fixed5';
    if (s === 'table' || s.indexOf('扣繳稅額表') >= 0 || s === 'lookup') return 'table';
    return 'fixed5';
  }

  function normalizeDependents(raw) {
    var n = parseInt(raw, 10);
    if (isNaN(n) || n < 0) return 0;
    return Math.min(11, n);
  }

  function calcFixedSalaryTax(input) {
    var mode = normalizeMode(input && input.mode);
    var monthlyGross = Math.floor(Math.max(0, Number(input && input.monthlyGross) || 0));
    var dependents = normalizeDependents(input && input.dependents);
    var rawTax = 0;
    if (mode === 'table') {
      var deductions = EXEMPTION * (1 + dependents) + STANDARD_DED + SALARY_DED;
      var taxableAnnual = Math.floor(Math.max(0, monthlyGross * 12 - deductions));
      if (taxableAnnual > 0) {
        var bracket = BRACKETS[0];
        for (var i = 0; i < BRACKETS.length; i++) {
          var b = BRACKETS[i];
          if (taxableAnnual >= b.min && (b.max == null || taxableAnnual <= b.max)) {
            bracket = b;
            break;
          }
        }
        var annualTax = Math.max(
          0,
          roundHalfUpDiv(taxableAnnual * bracket.rateNum - bracket.progressiveDiff * 100, 100)
        );
        rawTax = floorToTens(annualTax / 12);
      }
    } else {
      rawTax = roundHalfUpDiv(monthlyGross * 5, 100);
    }
    return {
      tax: rawTax <= EXEMPT_MAX ? 0 : rawTax,
      rawTax: rawTax,
      mode: mode,
      dependents: dependents
    };
  }

  function calcBonusTax(bonusAmount) {
    var amount = Math.floor(Math.max(0, Number(bonusAmount) || 0));
    if (amount < NON_MONTHLY_THRESHOLD) {
      return { tax: 0, amount: amount, threshold: NON_MONTHLY_THRESHOLD };
    }
    return {
      tax: roundHalfUpDiv(amount * 5, 100),
      amount: amount,
      threshold: NON_MONTHLY_THRESHOLD
    };
  }

  function calcNhiSupplementary(input) {
    var bonusAmount = Math.floor(Math.max(0, Number(input && input.bonusAmount) || 0));
    var insured = Math.floor(Math.max(0, Number(input && input.insuredSalaryLevel) || 0));
    var ytd = Math.floor(Math.max(0, Number(input && input.ytdBonusPaid) || 0));
    if (insured <= 0) {
      return { premium: 0, chargeable: 0, threshold: 0 };
    }
    var threshold = insured * NHI_MULT;
    var chargeable = Math.floor(Math.max(0, ytd + bonusAmount - Math.max(ytd, threshold)));
    var premium = chargeable > 0 ? roundHalfUpDiv(chargeable * NHI_RATE_NUM, NHI_RATE_DEN) : 0;
    return { premium: premium, chargeable: chargeable, threshold: threshold };
  }

  function calcBundle(input) {
    var fixed = calcFixedSalaryTax({
      mode: input && input.taxWithholdMode,
      monthlyGross: input && input.monthlyGross,
      dependents: input && input.taxDependentCount
    });
    var bonus = calcBonusTax(input && input.bonusAmount);
    var nhi = calcNhiSupplementary({
      bonusAmount: input && input.bonusAmount,
      insuredSalaryLevel: input && input.insuredSalaryLevel,
      ytdBonusPaid: input && input.ytdBonusPaid
    });
    return {
      fixedSalaryTax: fixed.tax,
      bonusTax: bonus.tax,
      nhiSupplementary: nhi.premium,
      total: fixed.tax + bonus.tax + nhi.premium,
      mode: fixed.mode,
      dependents: fixed.dependents
    };
  }

  global.TaxWithhold = {
    normalizeMode: normalizeMode,
    normalizeDependents: normalizeDependents,
    calcFixedSalaryTax: calcFixedSalaryTax,
    calcBonusTax: calcBonusTax,
    calcNhiSupplementary: calcNhiSupplementary,
    calcBundle: calcBundle,
    NON_MONTHLY_THRESHOLD: NON_MONTHLY_THRESHOLD
  };
})(typeof window !== 'undefined' ? window : globalThis);
