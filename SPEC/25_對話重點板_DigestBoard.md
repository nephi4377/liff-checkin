# 對話重點板（DigestBoard）短規格

**對齊：** Agent Store `docs/shared-digest-board-spec.md`（產品規格）  
**狀態：** MVP 可測版（未正式部署）

---

## 一句話

行政助理在板上填「對話重點／待辦」；管理層打開點狀態（已回覆／再交辦／暫擱／取消）。失敗不當空、不當成功。

---

## 入口

| 方式 | 路徑 |
| --- | --- |
| 主控台卡片 | `#/digest-board`（權限 ≥ 4） |
| 直接 URL | `/modules/projects/digest_board.html` |
| 本機 mock | `.../digest_board.html?mock=1` |

拍板：入口 A（主控台 iframe）；再交辦只走內部交辦；權限 B（管理 ≥ 4）。

---

## 前後端

| 層 | 位置 | 說明 |
| --- | --- | --- |
| 前端頁 | `modules/projects/digest_board.html` | 新增、列表、狀態、再交辦表單 |
| 快取規則 | `modules/projects/js/digestBoardCache.js` | 失敗保留舊列表 |
| 交辦複用 | `shared/js/taskSender.js`（`prefill`） | 再交辦預填重點＋案號 |
| 後端 | `Backend_GAS/project-console/DigestBoard.js` | 列表／新增／改狀態 |
| 試算表 | 回報簿分頁 `DigestBoard` | **不**寫入 NotificationCenter |

### API

| action / page | 動詞 | 用途 |
| --- | --- | --- |
| `digest_board_list` | GET `page=` 或 POST | 列表（可 `include_closed=1`） |
| `digest_board_create` | POST | 新增（狀態＝待處理） |
| `digest_board_update_status` | POST | 改狀態；可帶 `task_id` |

權限：員工 `權限` ≥ 4。

---

## 驗收（人話）

- 助理能新增「待回覆」，重整後看得到  
- 點「已回覆」立刻變；失敗還原並提示  
- 「再交辦」開交辦表單；成功後列狀態才變  
- 列表 API 失敗：有舊資料時不顯示「目前沒有待處理」  
- 未授權打不開（或 mock 本機示範）

## 不做（本版）

- 正式 clasp deploy／合 main  
- LINE 群同步  
- 自動掃群產摘要  
