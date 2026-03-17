# 添心專案：全量系統全景圖 (v3.0 - 生態整合版)

> [!TIP]
> **核心規格書導航**:
> - [01_核心設計原則與規範](file:///c:/Users/a9999/Dropbox/CodeBackups/CODING/SPEC/01_GLOBAL_DESIGN_STANDARD.md)
> - [04_互動室內設計規劃工具 SPEC](file:///c:/Users/a9999/Dropbox/CodeBackups/CODING/SPEC/04_INTERIOR_DESIGN_TOOL_SPEC.md)
> - [08_專案主控台：核心功能與通訊協定 SPEC](file:///c:/Users/a9999/Dropbox/CodeBackups/CODING/SPEC/08_PROJECT_CONSOLE_CRUD_SPEC.md)
> - [全量部署/開發記錄檔](file:///c:/Users/a9999/Dropbox/CodeBackups/CODING/部署記錄_CODING.md)

本文件以 Mermaid 流程圖展示 **CODING (Web SPA)** 與 **添心生產力助手 (Electron Client)** 的雙軌協作架構、通訊機制與 DevOps 聯動流向。

## 1. 系統全域生態圖

```mermaid
graph TD
    %% Ecosystem Entry
    USER(["使用者 (裝修團隊/總監)"]) --> WEB_ENTRY["CODING SPA<br/>(Liff Entry)"]
    USER --> CLIENT_ENTRY["添心生產力助手<br/>(Desktop Client)"]

    %% CODING Web SPA Layer
    subgraph CODING ["CODING (Web SPA Ecosystem)"]
        direction TB
        Shell["spa / app.js<br/>(Vue 3 Shell)"]
        Modules{{"業務模組 (Iframes)"}}
        Shell --- Modules
        
        subgraph ModDetail ["關鍵功能模組"]
            direction LR
            Report["施工回報 (Firebase/GAS)"]
            Design["設計引擎 (LayoutPlanner)"]
            HR["假勤管理 (Check-in/Approval)"]
            Project["專案主控台 (DependencyManager)"]
        end
        Modules --> ModDetail
    end

    %% Productivity Assistant Layer (Electron)
    subgraph Assistant ["添心生產力助手 (Electron Client)"]
        direction TB
        Main["main.js<br/>(Immutable Shell)"]
        DynamicCore{{"動態核心 (Patches)"}}
        Monitor["monitor.js<br/>(視窗標題監測)"]
        API_Bridge["apiBridge.js<br/>(iCloud/API 橋接)"]
        Updater["updater.js<br/>(GitHub Release 熱更)"]
        
        Main --- DynamicCore
        DynamicCore --> Monitor
        DynamicCore --> API_Bridge
        DynamicCore --> Updater
    end

    %% Backend & Persistence
    subgraph Backbone ["資料持久化與雲端服務 (Backbone)"]
        GAS["GAS 雲端 API<br/>(核心商務邏輯)"]
        FBS["Firebase Storage<br/>(圖片/二進位資源)"]
        Sheets[("Google 試算表<br/>(結構化數據)")]
        GDisk["Google Drive<br/>(專案存檔/備份)"]
    end

    %% DevOps & Knowledge Integration
    subgraph DevOps ["DevOps Hub & 日誌聯席"]
        DeployLog["部署記錄.md<br/>(跨專案溝通契約)"]
        GeminiMD["GEMINI.md<br/>(Agent 行為規範)"]
        KB["知識庫 3.0<br/>(法規/工法資料集)"]
    end

    %% Communication Paths
    ModDetail -- "單一出口 API" --> GAS
    ModDetail -- "並行上傳" --> FBS
    API_Bridge -- "數據補位" --> GAS
    API_Bridge -- "iCloud 抓取" --> Sheets
    
    %% DevOps Links
    Assistant -- "自動化日誌記錄" --> DeployLog
    DeployLog -- "部署軌跡回溯" --> Shell
    Assistant -- "規則約束" --> GeminiMD
    Shell -- "行為同步" --> GeminiMD
    
    %% Backend Sync
    GAS <--> Sheets
    FBS -.-> GDisk
    Sheets <--> KB

    %% Styling
    style CODING fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    style Assistant fill:#f1f8e9,stroke:#33691e,stroke-width:2px
    style Backbone fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style DevOps fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
```

## 🏗️ 核心架構矩陣 (Architectural Matrix)

| 系統 | 角色 | 核心承重牆 | 通訊協定 |
| :--- | :--- | :--- | :--- |
| **CODING (Web)** | 用戶端互動中心 | `app.js` (Router), `apiService.js` (Tunnel) | `postMessage` (Iframe), `Fetch` (GAS) |
| **助手 (Client)** | 專家監測與 DevOps | `main.js` (殼層), `monitor.js` (核心) | `IPC` (Main/Renderer), `HTTP` (Updater) |
| **Backend** | 數據大腦 | `WebApp.gs` (多路由處理器) | `RESTful API` (Structured Data) |
| **知識庫** | 法規與技術支援 | `知識庫_台灣室內裝修.md` | `Knowledge Retrieval` (Agent Context) |

---

## 🛠️ DevOps 聯動機制 (Cross-Project Integration)

1. **部署日誌中繼 (Log Sync)**:
   - 助手 (Client) 在執行 `upload.bat` 時，會自動更新 `部署記錄_添心生產力助手.md`。
   - CODING (Web) 的任何變動均以此日誌為「最終真相來源」，Agent 會根據此檔同步修改範圍。
2. **數據安全補位 (Data Guard)**:
   - 助手監視打卡狀態，並即時抓取 iCloud 提醒事項內容。
   - 透過 `apiBridge.js` 將數據補位至 CODING 的 GAS 系統中，確保跨設備數據一致。
3. **熱更新機制 (Hot Update)**:
   - 助手殼層 (`main.js`) 保持穩定，業務邏輯 (`monitor.js`) 透過 `patch.zip` 由 `updater.js` 動態拉取並替換，實現無感升級。

---
> [!IMPORTANT]
> **維護指令**: 任何涉及跨專案連動（如 API 參數變更）的修改，必須同步更新 `DevOps Hub` 中的部署記錄與相關專案的 `config.js`。
