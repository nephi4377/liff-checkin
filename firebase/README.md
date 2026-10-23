# Firebase RTDB 規則（本目錄）

| 檔案 | 用途 |
|------|------|
| `quotations.rules.fragment.json` | **Console 手動合併用片段**（僅 `quotations`）。**禁止** `firebase deploy`／`firebase deploy --only database`。 |
| `emulator.firebase.json` | **僅 Emulator** 設定（含 rules 路徑）；非正式 deploy 設定。 |
| `database.rules.emulator.json` | Emulator 單元測試 rules（含 `_emulator_unrelated_public` 探針）。 |
| `database.rules.emulator-legacy-public.json` | 模擬舊規則（公開 quotations）相容測試。 |
| `rtdb-rules.*.test.mjs` | `npm run test:rtdb-rules`／`test:rtdb-rules-legacy` |

根目錄**刻意不放** `firebase.json`，避免誤執行 CLI 部署覆蓋全專案 rules。

合併與上線見 `docs/runbooks/RTDB_QUOTATIONS_AUTH_RULES_RUNBOOK.md`。
