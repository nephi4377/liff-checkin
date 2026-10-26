/**
 * 模擬「舊規則：quotations 公開讀寫」+「新前端：匿名登入」仍可讀寫（先上前端相容）。
 * 執行：npm run test:rtdb-rules-legacy
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, get, set } from 'firebase/database';

const PROJECT_ID = 'tanxin-rtdb-legacy-compat';
const rules = readFileSync(
  new URL('./database.rules.emulator-legacy-public.json', import.meta.url),
  'utf8',
);

async function run() {
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: { rules },
  });

  const anonDb = testEnv.authenticatedContext('legacy-anon-1').database();
  const payload = { context: { items: [{ id: 't1', name: 'probe' }] } };

  await assertSucceeds(set(ref(anonDb, 'quotations/legacy-probe'), payload));
  await assertSucceeds(get(ref(anonDb, 'quotations/legacy-probe')));

  const publicDb = testEnv.unauthenticatedContext().database();
  await assertSucceeds(get(ref(publicDb, 'quotations/legacy-probe')));

  await testEnv.cleanup();
  console.log('ok legacy-public rules + authenticated client read/write');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
