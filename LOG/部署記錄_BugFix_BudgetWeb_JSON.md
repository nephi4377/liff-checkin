# 部署記錄 - 報價單 AI 預處理器 JSON 格式對齊修正

- **日期時間**: 2026-03-26 08:15
- **修改摘要/過程**: 
  針對使用者反映 `BudgetWeb_Standalone.html` 匯出的 JSON 檔案無法在 `BudgetAuditor_Standalone.html` 中正常讀取與使用的問題進行修正。經分析，主因為預處理器匯出的 JSON 結構未完全依循《11_1_AI_LOG_AND_PARAMETER_FULL_INTEGRATED_SPEC.md》定義的標準格式，缺少了根節點的案號 (`ctx_project_no`)、總結層級的案名與業主名稱，以及每個工項必備的進度 (`completion_percent`) 與驗證 (`verification`) 狀態欄位。已於 Web 端加入輸入介面並補全匯出結構，實現兩端無縫接軌。
- **技術明細**: 
  - **修改檔案**: 
    - `tools/BudgetWeb_Standalone.html`
    - `tools/BudgetAuditor_Standalone.html`
  - **關鍵邏輯變動**:
    - **[BudgetWeb端] Step 1.5 新增欄位**: 在 HTML 介面上加入 `projectInfoBox`，要求使用者於匯出前確認「案號 (ctx_project_no)」、「案場名稱 (project_name)」與「業主名稱 (client_name)」。
    - **[BudgetWeb端] 匯出結構補全**: 於 `items.map` 與 `finalExport` 組裝時，自動帶入 `status: 'PENDING'`, `completion_percent: 0`, 與 `verification`，並將收集來的表單資訊寫入 `total_summary`。
    - **[BudgetAuditor端] 向下相容強化**: 於 `loadData()` 解析進入點，實作向後相容防護。若載入舊版無 `ctx_project_no` 或 `total_summary` 的 JSON，將自動給予 `UNKNOWN_NO` 或空物件之預設值，同時遍歷 `items` 確保 `completion_percent` 與 `verification` 皆有初始值，避免 `undefined` 造成運算崩潰。
- **驗證結果**: 成功。預定義工項之結構已達稽核器 (Auditor) 所求之完整標準，且 Auditor 亦已能完美支援讀取舊版本所產出的精簡 JSON 檔案，徹底消弭版本升級過程中的格式斷層。版本穩定推進。
