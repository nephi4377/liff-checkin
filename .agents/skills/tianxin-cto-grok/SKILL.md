---
name: tianxin-cto-grok
description: >-
  讓小C／Nephi 透過 Automations webhook 與「程式設計總監」（Grok Bot）雙向交流：
  POST 觸發只回「已收到」；提示須附本對話 bc- 工作編號，總監回覆進該工作。
  勿寫總監筆記本、勿印 Secrets。
  Use when 問總監、請程式設計總監、Grok Bot、總監交流、tianxin-cto-grok,
  or user @ tianxin-cto-grok.
---

# Skill：程式設計總監交流（Grok Bot）

> 人讀計劃：Project Context `docs/程式設計總監-交流方案.md`  
> 定稿依據：2026-11-04 煙測 PASS＋「世界和平」雙向往返（工作 `bc-f41e53ba-…`）。

## 何時用

- 使用者說：問總監、請程式設計總監看、跟 Grok Bot 確認、總監交流
- 需要總監審 PR／給架構意見／拍板技術方向，且約定走 Automations 通道
- `@tianxin-cto-grok`

**不要用本 skill：** 一般 xAI chat completions、改總監筆記本當信箱、或未授權對外打 webhook。

## 管什麼／不管什麼

| 管 | 不管 |
|----|------|
| 用環境 Secrets 觸發程式設計總監 Automations | 印出／寫入金鑰或完整 webhook URL |
| 組 prompt、附 `bc-` 工作編號、確認「已收到」 | 把回覆寫進「總監筆記本」 |
| 在指定工作等待／轉述總監回覆 | 把 HTTP ack 當成總監正文 |
| 對齊偏好「程式設計總監串接」條 | 未明說就部署／合併／改額度設定 |

## Secrets（只核對有無，永不印值）

| 名稱 | 用途 |
|------|------|
| `XAI_API_KEY` | `Authorization: Bearer …` |
| `XAI_API_BASE` | Automations webhook 完整 URL（主機為 `api2.cursor.sh`；路徑已含 webhook id） |

- 文件、LOG、PR、回覆：**只寫 present／MISSING**；可寫主機名；**禁止**印 key、完整 URL、query、runUuid 全文（日誌最多寫「有 runUuid」）。
- `XAI_API_BASE` **已是完整觸發位址** → POST 時**不要**再拼 `/chat/completions`。

## 步驟

### 1. 確認可用

1. 檢查兩項 Secret **有值**（presence only）。缺一 → 停、用人話請 Nephi 補環境 Secrets，勿猜測 URL。
2. 取得**回覆要落進的工作編號**（`bc-…`）：
   - **專案／協調者對話**：用 Nephi／小C 正在看的那則 Project／父對話工作 id（回覆才看得見）。
   - **獨立單聊**：用本 run 的 `bcId`（可用 `cursor-cloud` → `run-info`）。
   - 使用者若指定某個 `bc-…`，以指定為準。

### 2. 組 prompt（必含工作編號）

固定結構（可依任務改中間正文；**不可省略**工作編號與落點說明）：

```text
【來自小C／Nephi → 程式設計總監】
（此處寫清楚要請總監做什麼／審什麼；必要脈絡精簡附上）

請把你的回覆送到這個 Cursor 工作（勿只寫進總監筆記本）：
工作編號：bc-……………………
```

規則：

- **一定要**寫明「請回覆到此 `bc-…`」。
- **不要**要求總監改寫／append 總監筆記本當雙向通道。
- 長文／大 diff：先收斂問題再送（對齊用量偏好：避免每小改就整包重審）。

### 3. 觸發（單向 ack）

```bash
# 示意：勿在指令列 echo 出 KEY／BASE 內容
curl -sS -X POST "$XAI_API_BASE" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"<上一步組好的全文>"}'
```

成功長相（概念）：HTTP 200，JSON 僅有 `success: true` 與 `runUuid` → 對人說**「已送到總監（已收到）」**。

**重點：** 這一回應**沒有**總監正文。不要輪詢 webhook 指望拿到 assistant text（對此 key 讀 run 結果不可用／非設計用途）。

### 4. 等雙向回覆

1. 留在／關注步驟 1 指定的那則工作。
2. 總監應把回覆**送進該工作**（可能延遲數十秒～數分鐘）。
3. 收到後：精簡轉述給 Nephi；需要再問就重複步驟 2～3（每次仍附同一或更新後的 `bc-…`）。

### 5. 回報使用者（短）

- 已觸發與否（勿貼 secret／完整 URL）
- 回覆落在哪個 `bc-…`
- 總監結論摘要；若尚未出現 → 說明「已收到、正文還在路上，請看該工作」

## 例外／失敗怎麼辦

| 情況 | 做法 |
|------|------|
| Secret 缺或空 | 停；請人補 `XAI_API_KEY`／`XAI_API_BASE` |
| HTTP 非 2xx／無 `success` | 停；報狀態類別（勿 dump 標頭裡的 token）；可隔數秒重試一次 |
| 有「已收到」但指定工作一直沒回覆 | 核對 prompt 是否漏 `bc-…`、是否指錯工作；**不要**改去寫總監筆記本；仍無則請人查 Automations 執行與額度 |
| 有人要你「把結果寫進總監筆記本」當雙向 | **拒絕該落點**；改附 `bc-…` 請總監回工作 |
| 把 BASE 當 chat API 去拼 completions、等 `choices` | 錯誤用法；本通道是 Automations webhook ack only |
| 日誌／PR 出現疑似 key 或完整 webhook | 立刻刪除／改寫為 presence；向使用者聲明已避免外洩 |

## 與偏好對齊（勿偏離）

- Secrets：`XAI_API_KEY`＋`XAI_API_BASE`（Automations webhook）
- 觸發＝單向；雙向＝prompt 附小C／本對話 `bc-`；總監回該工作
- **勿**改寫進總監筆記本
- 不印 secret 值

## 驗收參考（已通過，勿重洩密）

- 煙測：env 齊、POST 200、ack `success`＋`runUuid`
- 雙向：prompt 含 `bc-f41e53ba-92dd-445c-ac73-43b568c44a6a`，「世界和平」進該工作
