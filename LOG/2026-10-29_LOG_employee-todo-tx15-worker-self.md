# 2026-10-29 TX-15 工務自建／來源／編輯鎖定／綠鈕／派工可見工務說明

## Diff／目的

- 工務介面可新增工作 → Sheet `todo_add`，來源標「工務自建」
- 新增按「加入」後鎖定；點「編輯」才改（僅自建；派工派來的維持勾完成／工務說明）
- 派工頁任務卡顯示只讀「工務說明」；派工欄位也需點編輯
- 綠鈕「用 LINE 登入同步試算表」改頂部，不擋底部「加入」

## 技術

- FE：`modules/projects/employee-todo/` Mantle bundle 補丁＋`sheet-bridge.js`；`et-build=20261029d`
- GAS：`employee_todo.js` 保留「自建」assigner；`clientRole=worker` 時限制非自建 patch

## 驗證

- [ ] live HTML 含 `20261029d`
- [ ] `?role=ende&preview=1`：＋新增工作、派自工務自建、編輯鎖定
- [ ] `?role=paigong&preview=1`：可見工務說明；綠鈕在頂不擋加入
