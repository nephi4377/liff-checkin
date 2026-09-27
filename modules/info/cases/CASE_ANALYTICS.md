# 添心設計｜案例成效監控規格

更新日期：2026-09-27

## 目標
追蹤「Google 曝光 → 進入案例 → 閱讀／觀看 → 聯絡 → 詢問」完整漏斗。

## 已確認
- `https://tanxin.space/` 已有 Google Search Console 資料。
- `https://info.tanxin.space/` 已有 Google Search Console 資料。
- 舊案例入口已搬至 `https://tanxin.space/portfolio/project-<案號>/`。
- 舊案例入口導向正式站時加入逐案 UTM 與 `legacy_case`，供正式站 GA4 歸因。

## 舊入口導流參數
- `utm_source=info.tanxin.space`
- `utm_medium=referral`
- `utm_campaign=case_migration`
- `utm_content=case_<案號>`
- `legacy_case=<案號>`

Canonical 必須保持正式乾淨網址，不帶 UTM。

## 正式作品集 GA4 事件契約
正式站所有 `/portfolio/` 頁面共用單一 GA4 Web Data Stream。

### 共用維度
- `case_id`：案號
- `content_group`：固定 `portfolio_case`
- `case_city`：有資料才送
- `case_type`：有資料才送
- `case_style`：有資料才送

### 事件
- `case_view`：案例頁有效載入。
- `case_engaged`：停留 >= 30 秒或捲動 >= 75%。
- `youtube_click`：點擊案例 YouTube。
- `line_click`：點擊 LINE。
- `phone_click`：點擊 tel:。
- `inquiry_click`：點擊諮詢／預約／需求表單。

所有事件至少附 `case_id`。

## Key events
- `line_click`
- `phone_click`
- `inquiry_click`

## Dashboard 最少欄位
案號、Views、Users、Avg engagement time、Search impressions、Search clicks、CTR、YouTube clicks、LINE clicks、Phone clicks、Inquiry clicks、Inquiry rate。

## 驗收
1. 舊案例網址跳轉後含 `utm_content=case_<案號>` 與 `legacy_case=<案號>`。
2. Canonical 不含 UTM。
3. Search Console 持續收集正式站與舊站搜尋資料。
4. GA4 啟用後用 Realtime / DebugView 驗證案例與 CTA 事件。
