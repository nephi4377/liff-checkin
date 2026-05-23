---
name: premium-ui-design
description: >-
  新增或美化 CODING 網頁 UI 時使用。Tailwind、淺灰底、圓角卡片、按鈕 hover／input focus；
  適用 spa、modules 內 Tailwind 頁，不強制套用在 WordPress 匯出官網。
---

# Premium UI／UX 設計

> 產出的網頁 UI 盡量符合專案「高質感」慣例（與 `spa/Dashboard.js` 等現有頁一致）。
## 🎨 視覺規範 (Visual Rules)
1. **配色 (Coloring)**：
   - 禁用純色背景。優先使用 `bg-gray-50` 或 `bg-[#f8fafc]`。
   - 主色調：使用 HSL 色標 (Primary: 221 83% 53% - Blue 600)。
2. **間距與圓角 (Spacing & Radius)**：
   - 所有卡片必須使用 `rounded-lg` 或 `rounded-xl` 並帶有 `shadow-md` 或 `shadow-sm`。
   - 禁止使用緊湊佈局，必須確保 `p-6` (24px) 以上的負空間感。
3. **動態 (Micro-animations)**：
   - 所有按鈕與連結必須具備 `transition-all duration-300` 與 `hover:shadow-lg`。
   - `input` 焦點狀態必須具備 `focus:ring-2` 緩動效果。

## 🧩 組件標準 (Component Standards)
- **卡片 (Card)**：`bg-white rounded-xl shadow-sm border border-gray-100`。
- **標籤 (Badge)**：`px-2.5 py-0.5 rounded-full text-xs font-semibold`。

---
## 執行方式

使用者要求「新增網頁」「美化 UI」「改版面」時載入本 skill；與 `00-general-plain-language` 衝突時以專案白話規則為準。