# 2026-11-09 LOG — 離職連動前端提示

| 項目 | 內容 |
|------|------|
| 目的 | 員工資料存檔離職後，顯示連動摘要（不顯示薪資金額） |
| 分支 | `cursor/resign-link-18bc` |
| 對應後端 | Backend_GAS RESIGN-LINK draft PR |

## Diff

- `modules/attendance/employee_editor.html`：成功訊息附加擋打卡／清班表／關薪資／特休草稿提示
- `SPEC/未來開發事項.md`、`SPEC/17_…`：離職結算改指後端草稿
- `tools/test-resign-link-editor.mjs`

## 驗證

```bash
node --test tools/test-resign-link-editor.mjs
```
