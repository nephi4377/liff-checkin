/**
 * 單元煙測：主控台 liff_id_token 組裝與 JWT 效期（邏輯與 shared/js/console_liff_session.js 對齊）
 * node modules/projects/tools/test-console-liff-session.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assert failed');
}

const LIFF_TOKEN_SKEW_SEC = 60;

function decodeJwtPayload_(token) {
  try {
    if (!token) return null;
    const parts = String(token).split('.');
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = decodeURIComponent(Buffer.from(b64, 'base64').toString('binary').split('').map((c) =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function isLiffIdTokenFresh(token) {
  if (!token) return false;
  const payload = decodeJwtPayload_(token);
  if (!payload || payload.exp == null) return false;
  const expSec = parseInt(payload.exp, 10) || 0;
  if (!expSec) return false;
  return expSec > (Math.floor(Date.now() / 1000) + LIFF_TOKEN_SKEW_SEC);
}

function mergeConsoleLiffAuth(target, token) {
  const out = target && typeof target === 'object' ? { ...target } : {};
  if (token && isLiffIdTokenFresh(token)) {
    out.liff_id_token = token;
  }
  return out;
}

function makeJwt(expSec) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp: expSec })).toString('base64url');
  return `${header}.${payload}.sig`;
}

const future = Math.floor(Date.now() / 1000) + 3600;
const past = Math.floor(Date.now() / 1000) - 60;
assert(isLiffIdTokenFresh(makeJwt(future)), 'fresh token');
assert(!isLiffIdTokenFresh(makeJwt(past)), 'expired token');

const merged = mergeConsoleLiffAuth({ action: 'createLog' }, makeJwt(future));
assert(merged.liff_id_token && merged.action === 'createLog', 'merge adds liff_id_token');

const root = path.join(__dirname, '../../..');
const projectApi = fs.readFileSync(path.join(root, 'modules/projects/js/projectApi.js'), 'utf8');
const spaApp = fs.readFileSync(path.join(root, 'spa/app.js'), 'utf8');
const reportV3 = fs.readFileSync(path.join(root, 'modules/projects/reportV3.html'), 'utf8');

assert(projectApi.includes('console_liff_session.js'), 'projectApi wires console liff');
assert(projectApi.includes('mergeConsoleLiffAuth'), 'projectApi merge on write');
assert(spaApp.includes('get_hub_projects_data') && spaApp.includes('appendConsoleLiffToUrl'), 'hub projects GET token');
assert(spaApp.includes('process_notification_action') && spaApp.includes('mergeConsoleLiffAuth'), 'hub notification POST token');
assert(reportV3.includes('mergeConsoleLiffAuth'), 'reportV3 submit token');

console.log('test-console-liff-session: OK');
