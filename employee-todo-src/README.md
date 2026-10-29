# 員工待辦／派工

## 正式站現況（2026-10-29）

**正式靜態包已緊急回滾**至 MantleDB 版（`employee-todo/assets/index-B0wpJKiW.js`，對應 `284e22e`）。

SEC-1（LIFF + `todo_*` GAS）因 LINE LIFF Endpoint／Callback **未**納入 `https://info.tanxin.space/employee-todo/`，外開會 400 `invalid url`，故暫時不可建置覆蓋正式目錄。

**在 LINE Developers 為 LIFF（或獨立 LIFF）登記 Endpoint＝`https://info.tanxin.space/employee-todo/` 並驗證登入前，請勿執行 `npm run build`。**

---

## SEC-1 源碼（尚未可上線）

React 源碼在本目錄；建置輸出至 `../employee-todo/`。設計為寫入走 project-console GAS（`liff_id_token`），不含 mantledb 金鑰或 PIN。

```bash
npm ci
npm test          # unit
# npm run build   # 禁止覆寫正式包，直到 LIFF Endpoint 就緒
```

預覽（無 LIFF）：`?preview=1`（僅本機／測試包）
