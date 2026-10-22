# FLOORPLAN-INTEGRATE-1

整合分支：`cursor/floorplan-integrate-1`（不 merge、不覆蓋 `main` / info.tanxin.space 現行版）。

## 獨立測試連結（jsDelivr，指向本分支）

- **一鍵 3D 室內漫遊預覽**：  
  `https://cdn.jsdelivr.net/gh/nephi4377/liff-checkin@cursor/floorplan-integrate-1/modules/InteriorDesigned/LP_LayoutPlanner_3d_walk_preview.html`
- **3D 鳥瞰＋快照／預設角度**（`lp3d=orbit`）：  
  `https://cdn.jsdelivr.net/gh/nephi4377/liff-checkin@cursor/floorplan-integrate-1/modules/InteriorDesigned/LP_LayoutPlanner?lpPreview=1&lpFixture=e2e/fixtures/lp-3d-spec-demo.json&lp3d=orbit`
- **完整 LayoutPlanner（2D＋3D）**：  
  `https://cdn.jsdelivr.net/gh/nephi4377/liff-checkin@cursor/floorplan-integrate-1/modules/InteriorDesigned/LP_LayoutPlanner?lpPreview=1`

本機：`npx --yes serve@14 -l 8080 .` 後開  
`http://127.0.0.1:8080/modules/InteriorDesigned/LP_LayoutPlanner_3d_walk_preview.html`

## 已在 main 的 3D 基底（本整合不重複開 PR）

| PR | 說明 |
|----|------|
| #176 | 3D 檢視 MVP |
| #183 | 牆體／門窗 CSG／地板／行走／全螢幕 UI |

## 原 open PR 整合表

| PR | 已整合 | 衝突與解法 | 待 Nephi |
|----|--------|------------|----------|
| #192 area NaN | ✅ | 無 | — |
| #184 2D audit＋吸附 | ✅ | `LP_core`／`LP_LayoutPlanner` import：保留 #192 坪數函式與 #184 吸附 API | — |
| #187 鏡像＋群組 | ✅ | 無 | — |
| #194 段長標籤＋頂點吸附 | ✅ | 無 | — |
| #186 報價／BudgetWeb 草稿 | ✅ | vitest include 合併 history＋quote；雙 import | 原型是否進正式版 |
| #198 3D 漫遊驗收 | ✅ | vitest 合併 walk 測試檔 | — |
| #200 3D 快照／預設角度 | ✅ | 無 | `lpPreview=1` 才顯示的工具列是否上線 |
| #202 3D 效能 | ✅ | vitest 合併 dispose／lifecycle | — |
| #188 CI | ✅ | 無 | — |
| #190 視覺回歸 | ✅ | 2D 基準圖因整合後 UI 微差（318px）已更新 snapshot | 是否接受新 2D 基準圖 |
| #191 3D-5 稽核 | ⚪ | 分支相對整合點 **Already up to date**（稽核／文件向，實作在 main #183） | — |
| #31 元件表失敗可見 | ✅ | e2e `LP_layout-planner.spec.cjs` 重複 `require('fs')` 已刪 | — |

## 未納入（非本輪 LayoutPlanner 整合範圍）

| PR | 原因 |
|----|------|
| #40 平面圖校正 OpenCV | 不同頁（`floorplan-straightener`） |
| 其他非 floorplan 的 open draft | 與本任務無關 |

## 驗證（整合分支 HEAD）

- Vitest：**89/89** 通過  
- Playwright e2e：**22/22** 通過（含 #190 視覺、#202 perf spec）
