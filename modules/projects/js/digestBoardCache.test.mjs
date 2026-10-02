import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeDigestBoardListFetch,
  applyOptimisticStatus,
  rollbackOptimisticStatus,
  partitionOpenAndClosed
} from './digestBoardCache.js';

describe('mergeDigestBoardListFetch', () => {
  it('成功覆寫並可確認空列表', () => {
    const out = mergeDigestBoardListFetch([{ item_id: 'a' }], { ok: true, items: [] });
    assert.equal(out.error, '');
    assert.equal(out.saveCache, true);
    assert.equal(out.emptyConfirmed, true);
    assert.deepEqual(out.items, []);
  });

  it('失敗且有舊資料時保留舊列表，不當空', () => {
    const prev = [{ item_id: 'keep', summary: '舊資料' }];
    const out = mergeDigestBoardListFetch(prev, { ok: false, message: '網路斷了', items: [] });
    assert.equal(out.error, '網路斷了');
    assert.equal(out.saveCache, false);
    assert.equal(out.emptyConfirmed, false);
    assert.equal(out.items.length, 1);
    assert.equal(out.items[0].item_id, 'keep');
  });

  it('失敗且無舊資料時不自稱空成功', () => {
    const out = mergeDigestBoardListFetch([], { ok: false, message: '逾時' });
    assert.equal(out.emptyConfirmed, false);
    assert.equal(out.error, '逾時');
    assert.deepEqual(out.items, []);
  });
});

describe('optimistic status', () => {
  it('點狀態先變樣子，失敗可還原', () => {
    const list = [{ item_id: '1', status: '待處理', summary: '測' }];
    const { items: next, snapshot } = applyOptimisticStatus(list, '1', '已回覆');
    assert.equal(next[0].status, '已回覆');
    assert.equal(snapshot.status, '待處理');
    const rolled = rollbackOptimisticStatus(next, snapshot);
    assert.equal(rolled[0].status, '待處理');
  });
});

describe('partitionOpenAndClosed', () => {
  it('待處理在開、已回覆在關', () => {
    const { open, closed } = partitionOpenAndClosed([
      { item_id: 'a', status: '待處理' },
      { item_id: 'b', status: '已回覆' },
      { item_id: 'c', status: '暫擱' }
    ]);
    assert.equal(open.length, 2);
    assert.equal(closed.length, 1);
  });
});
