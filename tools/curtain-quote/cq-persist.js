/**
 * 窗簾估價 — 草稿 localStorage
 */
(function (global) {
  'use strict';

  var DRAFT_KEY = 'cq_curtain_draft_v1';

  function loadDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveDraft(state) {
    try {
      var payload = {
        savedAt: new Date().toISOString(),
        quoteTitle: state.quoteTitle,
        customerName: state.customerName,
        windows: state.windows
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) { /* ignore */ }
  }

  global.CQ_PERSIST = {
    DRAFT_KEY: DRAFT_KEY,
    loadDraft: loadDraft,
    saveDraft: saveDraft,
    clearDraft: clearDraft
  };
})(typeof window !== 'undefined' ? window : globalThis);
