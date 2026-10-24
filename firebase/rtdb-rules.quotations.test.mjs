/**
 * RTDB 規則單元測試（Firebase Emulator）
 * 執行：npm run test:rtdb-rules
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, get, set } from 'firebase/database';

const PROJECT_ID = 'tanxin-rtdb-rules-test';
const rules = readFileSync(new URL('./database.rules.emulator.json', import.meta.url), 'utf8');

let testEnv;

async function beforeAll() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: { rules },
  });
}

async function afterAll() {
  await testEnv.cleanup();
}

function dbFor(auth) {
  const ctx = auth ? testEnv.authenticatedContext(auth.uid, auth.token || {}) : testEnv.unauthenticatedContext();
  return ctx.database();
}

async function run() {
  await beforeAll();
  let passed = 0;
  const assert = async (name, fn) => {
    try {
      await fn();
      passed += 1;
      console.log('ok', name);
    } catch (e) {
      console.error('FAIL', name, e);
      await afterAll();
      process.exit(1);
    }
  };

  await assert('unauthenticated read quotations denied', async () => {
    const db = dbFor(null);
    await assertFails(get(ref(db, 'quotations/752')));
  });

  await assert('unauthenticated write quotations denied', async () => {
    const db = dbFor(null);
    await assertFails(set(ref(db, 'quotations/752'), { context: { items: [] } }));
  });

  await assert('anonymous read quotations allowed', async () => {
    const db = dbFor({ uid: 'anon-1' });
    await assertSucceeds(set(ref(db, 'quotations/752'), { context: { items: [] } }));
    await assertSucceeds(get(ref(db, 'quotations/752')));
  });

  await assert('unrelated public node still readable without auth', async () => {
    const db = dbFor(null);
    await assertSucceeds(get(ref(db, '_emulator_unrelated_public/probe')));
  });

  await afterAll();
  console.log(`\n${passed} rules tests passed`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
