import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  humanLogsFail,
  humanAuditFail,
  logsViewState,
  auditViewState,
  retryOnce,
} from './clientProgressLoadUi.mjs';

describe('客人施工進度載入狀態', () => {
  it('連線失敗用人話，不是 Failed to fetch', () => {
    assert.equal(
      humanLogsFail(new Error('Failed to fetch')),
      '施工紀錄暫時載入不到，請再試一次'
    );
    assert.equal(
      humanAuditFail(new Error('NetworkError when attempting to fetch resource.')),
      '施工項目暫時載入不到，請再試一次'
    );
  });

  it('後端有帶人話就保留', () => {
    assert.equal(humanLogsFail('尚未綁定此案件'), '尚未綁定此案件');
  });

  it('讀失敗是 fail，不是 empty', () => {
    assert.equal(logsViewState(false, 0), 'fail');
    assert.equal(auditViewState(false, false), 'fail');
  });

  it('成功且 0 筆才是真的沒紀錄', () => {
    assert.equal(logsViewState(true, 0), 'empty');
    assert.equal(auditViewState(true, false), 'empty');
  });

  it('成功且有資料是 ok', () => {
    assert.equal(logsViewState(true, 2), 'ok');
    assert.equal(auditViewState(true, true), 'ok');
  });

  it('第一次失敗會再試一次', async () => {
    let n = 0;
    const out = await retryOnce(async () => {
      n += 1;
      if (n === 1) throw new Error('once');
      return 'ok';
    });
    assert.equal(out, 'ok');
    assert.equal(n, 2);
  });
});
