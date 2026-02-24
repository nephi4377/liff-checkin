# Skill: Premium UI/UX Design System
> 此技能模組確保所有產出的網頁 UI 均符合「高質感 (Premium)」標準。

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
每當使用者要求「新增網頁」或「美化 UI」時，Antigravity 將自動引用此規範進行開發。
