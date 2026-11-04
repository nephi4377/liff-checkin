'use strict';

/** 與 shared/js/accounting_api.js `parseGateTicketExpiresMs_` 保持同步（Backend_GAS #276） */
var HUB_GATE_TICKET_DEFAULT_TTL_MS = 90000;
var HUB_GATE_TICKET_EARLY_MS = 15000;
var HUB_GATE_TICKET_MAX_CACHE_MS = 100000;

function parseGateTicketExpiresMs(res, nowMs) {
  var now = nowMs != null ? nowMs : Date.now();
  if (!res) return now + HUB_GATE_TICKET_DEFAULT_TTL_MS;
  if (res.expires_in_sec != null) {
    var inSec = Number(res.expires_in_sec);
    if (isFinite(inSec) && inSec > 0) {
      var cacheMs = Math.min(inSec * 1000 - HUB_GATE_TICKET_EARLY_MS, HUB_GATE_TICKET_MAX_CACHE_MS);
      if (cacheMs < 1000) cacheMs = 1000;
      return now + cacheMs;
    }
  }
  if (res.expires_at_ms != null) {
    var msNum = Number(res.expires_at_ms);
    if (isFinite(msNum) && msNum > 0) return msNum;
  }
  if (res.expires_at != null) {
    var parsed = Date.parse(String(res.expires_at));
    if (isFinite(parsed)) return parsed;
  }
  if (res.valid_seconds != null) {
    var sec = Number(res.valid_seconds);
    if (isFinite(sec) && sec > 0) return now + sec * 1000;
  }
  if (res.ttl_seconds != null) {
    var ttl = Number(res.ttl_seconds);
    if (isFinite(ttl) && ttl > 0) return now + ttl * 1000;
  }
  return now + HUB_GATE_TICKET_DEFAULT_TTL_MS;
}

module.exports = {
  HUB_GATE_TICKET_DEFAULT_TTL_MS: HUB_GATE_TICKET_DEFAULT_TTL_MS,
  parseGateTicketExpiresMs: parseGateTicketExpiresMs
};
