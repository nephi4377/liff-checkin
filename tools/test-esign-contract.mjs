/**
 * ESIGN-CONTRACT-2 前端：範本、審閱、雙方簽名板、列印、紙本
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = join(root, 'modules/projects/data/esign-contract-2025-0922.json');
const htmlPath = join(root, 'modules/projects/esign-contract.html');
const apiPath = join(root, 'modules/projects/js/esign-contract-api.js');
const mainPath = join(root, 'modules/projects/js/esign-contract-main.js');

const backendCandidates = [
  process.env.ESIGN_BACKEND_CONTRACT_JSON,
  join(root, '../backend_gas/project-console/data/esign-contract-2025-0922.json'),
  join(root, '../Backend_GAS/project-console/data/esign-contract-2025-0922.json'),
].filter(Boolean);

test('contract template JSON exists with version and 29 articles', () => {
  const json = JSON.parse(readFileSync(dataPath, 'utf8'));
  assert.equal(json.version, '2025-0922');
  assert.equal(json.articles.length, 29);
  assert.equal(json.default_payment_schedule.map((x) => x.ratio).join('/'), '30/30/30/10');
  assert.match(json.voluntary_early.label, /自願提前/);
  assert.equal(json.review_clause.review_days, 7);
  assert.ok(json.field_placeholders.includes('party_a_name'));
  assert.ok(json.paper_option_note);
});

test('frontend template matches backend copy when present', function () {
  const front = JSON.parse(readFileSync(dataPath, 'utf8'));
  let backPath = backendCandidates.find((p) => existsSync(p));
  if (!backPath) {
    this.skip();
    return;
  }
  const back = JSON.parse(readFileSync(backPath, 'utf8'));
  assert.deepEqual(front, back);
  const fh = createHash('sha256').update(JSON.stringify(front), 'utf8').digest('hex');
  const bh = createHash('sha256').update(JSON.stringify(back), 'utf8').digest('hex');
  assert.equal(fh, bh);
});

test('customer page has review, dual signature pads, print and paper option', () => {
  const html = readFileSync(htmlPath, 'utf8');
  assert.match(html, /earlyCheck/);
  assert.match(html, /已充分審閱，自願提前簽約/);
  assert.match(html, /btnReady/);
  assert.match(html, /canvasA/);
  assert.match(html, /canvasB/);
  assert.match(html, /btnSignA/);
  assert.match(html, /btnSignB/);
  assert.match(html, /btnPrint/);
  assert.match(html, /btnPaper/);
  assert.match(html, /改用紙本/);
  assert.match(html, /printArea/);
  assert.match(html, /esign-contract-main\.js/);
});

test('API module posts esign_contract_* actions including sign and print', () => {
  const api = readFileSync(apiPath, 'utf8');
  for (const a of [
    'esign_contract_get',
    'esign_contract_staff_send',
    'esign_contract_open',
    'esign_contract_ack_early',
    'esign_contract_ready',
    'esign_contract_sign_party_a',
    'esign_contract_sign_party_b',
    'esign_contract_paper_opt',
    'esign_contract_print',
    'esign_contract_status',
  ]) {
    assert.match(api, new RegExp(a));
  }
});

test('main only treats 127.0.0.1/localhost + ?dev=1 as local; staff via ?staff=1', () => {
  const main = readFileSync(mainPath, 'utf8');
  assert.match(main, /127\.0\.0\.1/);
  assert.match(main, /localhost/);
  assert.match(main, /dev/);
  assert.match(main, /staff/);
  assert.doesNotMatch(main, /\?local=1|local===|local ==/);
  assert.match(main, /signPartyA|SignPartyA/);
  assert.match(main, /signPartyB|SignPartyB/);
  assert.match(main, /paperOpt/);
  assert.match(main, /print/);
  assert.match(main, /window\.print/);
});
