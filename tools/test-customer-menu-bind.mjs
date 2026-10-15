import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const html = readFileSync(new URL('../modules/accounting/customer-finance-portal.html', import.meta.url), 'utf8');
const start = html.indexOf("    $('btnBindSubmit').onclick = function () {");
const end = html.indexOf('    function fmtPortalDate', start);
assert.ok(start >= 0 && end > start);
const handler = html.slice(start, end);

async function submit(response) {
  const elements = {};
  const messages = [];
  function element(id) {
    if (!elements[id]) {
      const classes = new Set(id === 'bindDoneCard' ? ['hidden'] : []);
      elements[id] = {value: '123', classList: {
        add: name => classes.add(name), remove: name => classes.delete(name),
        toggle(name, value) {if (value) classes.add(name); else classes.delete(name);},
        contains: name => classes.has(name)
      }};
    }
    return elements[id];
  }
  let pending;
  const context = vm.createContext({
    $: element, staffPreview: false, session: {},
    showBindMsg: (...args) => messages.push(args), portalMockMode: () => '',
    CustomerFinanceUi: {runBtnAsync(button, fn) {pending = fn();}},
    AccountingApi: {
      cfPortalSelfBind: async () => response,
      cfPortalAuth: async () => ({success: true, projects: [{project_no: '123'}]})
    },
    fillProjects() {}, humanBindFail: () => '連線失敗'
  });
  vm.runInContext(handler, context);
  element('btnBindSubmit').onclick();
  await pending;
  return {element, messages};
}

test('success flag without a verified menu never opens the completion card', async () => {
  for (const response of [
    {success: true},
    {success: true, rich_menu_sync: {success: false}},
    {success: true, rich_menu_sync: {richMenuId: 'member'}},
    {success: true, rich_menu_sync: {verified: true}}
  ]) {
    const f = await submit(response);
    assert.equal(f.element('bindDoneCard').classList.contains('hidden'), true);
    assert.equal(f.messages.at(-1)[1], 'err');
  }
});

test('verified six opens completion card, partial binding shows retry message', async () => {
  const complete = await submit({success: true, rich_menu_sync: {success: true, verified: true, richMenuId: 'member'}});
  assert.equal(complete.element('bindDoneCard').classList.contains('hidden'), false);
  assert.match(complete.element('bindDoneText').textContent, /已掛載並確認/);
  const partial = await submit({success: false, binding_saved: true, message: '選單尚未完成，請重試'});
  assert.equal(partial.element('bindDoneCard').classList.contains('hidden'), true);
  assert.equal(partial.messages.at(-1)[0], '選單尚未完成，請重試');
});
