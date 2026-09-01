import { strict as assert } from 'node:assert';
import {
  LOG_TEXT_SAVE_FAIL_MESSAGE,
  snapshotLogText,
  writeLogText,
  restoreLogText,
  snapshotLogTextInList,
  writeLogTextInList
} from './logTextRollback.mjs';

const cache = {
  data: {
    dailyLogs: [
      { LogID: 'LOG-1', Content: '舊進度：泥作完成' },
      { LogID: 'LOG-2', Content: '另一則' }
    ]
  }
};

const snap = snapshotLogText(cache, 'LOG-1');
assert.equal(snap.found, true);
assert.equal(snap.previousText, '舊進度：泥作完成');

assert.equal(writeLogText(cache, 'LOG-1', '新進度：木作進場'), true);
assert.equal(cache.data.dailyLogs[0].Content, '新進度：木作進場');

assert.equal(restoreLogText(cache, 'LOG-1', snap.previousText), true);
assert.equal(cache.data.dailyLogs[0].Content, '舊進度：泥作完成');
assert.equal(cache.data.dailyLogs[1].Content, '另一則');

assert.equal(snapshotLogText({ data: {} }, 'LOG-1').found, false);
assert.equal(writeLogText(cache, 'LOG-missing', 'x'), false);
assert.ok(LOG_TEXT_SAVE_FAIL_MESSAGE.includes('沒存到'));
assert.ok(LOG_TEXT_SAVE_FAIL_MESSAGE.includes('編輯文字'));

const list = [{ LogID: 'LOG-1', Content: '現場備註' }];
const listSnap = snapshotLogTextInList(list, 'LOG-1');
assert.equal(listSnap.previousText, '現場備註');
writeLogTextInList(list, 'LOG-1', '已改');
assert.equal(list[0].Content, '已改');
writeLogTextInList(list, 'LOG-1', listSnap.previousText);
assert.equal(list[0].Content, '現場備註');

console.log('logTextRollback.test.mjs ok');
