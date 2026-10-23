# Firebase RTDB 規則（本目錄）

| 檔案 | 用途 |
|------|------|
| `database.rules.json` | **正式合併用片段**：僅 `quotations` 節點。不可單獨 deploy 覆蓋全專案 rules。 |
| `database.rules.emulator.json` | Emulator 單元測試用（含 `_emulator_unrelated_public` 探針節點）。 |
| `rtdb-rules.quotations.test.mjs` | `npm run test:rtdb-rules` |

合併與上線步驟見 `docs/runbooks/RTDB_QUOTATIONS_AUTH_RULES_RUNBOOK.md`。
