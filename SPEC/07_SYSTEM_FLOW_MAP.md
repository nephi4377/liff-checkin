# CODING 專案：系統流程全景圖 (v2.2)

本文件以 Mermaid 流程圖形式展示 **CODING** 專案全量模組間的層級關係、通訊機制與後端整合流向。

## 1. 系統架構全景圖

```mermaid
graph TD
    %% Entry
    Entry["index.html<br/>(系統入口 Entry)"] --> Shell

    %% Shell Layer (Blue Box)
    subgraph Shell ["spa / app.js (中樞殼層 Vue 3 Shell)"]
        LIFF["LIFF 認證<br/>(Line Auth)"]
        Tunnel["全域狀態管理<br/>(Message Tunnel)"]
        Router["路由調度<br/>(Hash Router)"]
        Loader["Iframe 動態嵌入<br/>(Module Loader)"]
    end

    %% Modules Layer (Green Box)
    subgraph Modules ["業務功能模組 (Iframes)"]
        direction LR
        Report["施工回報 (Report)<br/>(Photo Reporting)"]
        HR["人事系統 (HR)<br/>(Attendance & Leave)"]
        Design["設計工具 (Design)<br/>(2D Planner)"]
        Project["專案管理 (Project)<br/>(Console & Log)"]
    end

    %% Communication Paths
    Loader -- "URL 參數傳遞" --> Modules
    Modules -- "postMessage 指令" --> Tunnel

    %% Shared Utilities (Purple Box)
    subgraph Utilities ["公共工具集"]
        direction LR
        Utils["utils.js"]
        Task["taskHandler.js"]
        Config["config.js"]
    end
    Modules -- "依賴引入" --- Utilities

    %% Persistence Layer (Orange Box)
    subgraph Persistence ["資料持久化 (Data Backbone)"]
        GAS["GAS 雲端 API<br/>(Business Logic)"]
        FBS["Firebase 儲存<br/>(Binary Assets)"]
        Sheets["Google 試算表<br/>(Configuration Data)"]
    end

    %% Client Cache (Grey Box)
    subgraph Client ["客戶端持久化 (Client)"]
        LStorage["LocalStorage<br/>(Offline Cache & Utils)"]
    end

    %% Backend Connections
    Utilities --- Persistence
    Report -- "第一出口 API" --> GAS
    Report -- "Fire-and-Forget 上傳" --> FBS
    HR -- "依賴引入" --> Utilities
    Project -- "依賴引入" --> Utilities
    Design -- "依賴引入" --> Utilities
    LStorage <--> HR
    
    FBS -.-> AutoGen["自動背景生成"]
    AutoGen -.-> Sheets
    GAS <--> Sheets

    %% Styling
    style Shell fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    style Modules fill:#f1f8e9,stroke:#33691e,stroke-width:2px
    style Utilities fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    style Persistence fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style Client fill:#eceff1,stroke:#263238,stroke-width:2px
```

## 🏗️ 核心承重牆模組 ( लोड-bearing Components)

| 模組 | 角色 | 核心技術點 | 依賴關係 |
| :--- | :--- | :--- | :--- |
| **`app.js`** | 系統心臟 | SPA 路由調度與 Iframe PostMessage 通訊協定 | 所有渲染元件 (Modules) |
| **`apiService.js`** | 通訊骨幹 | 非同步 Job 輪詢與寫入隊列管理 | GAS Web App |
| **`DependencyManager`** | 資料調度員 | 事件驅動的資料就緒偵測與元件重繪 | 全域 `state` (Message Tunnel) |
| **`reportV2.html`** | 數據入口 | Firebase/GAS 雙軌同步與圖片並行壓縮 | Firebase Auth (Fire-and-Forget) |

---
> [!IMPORTANT]
> **維護指令**: 任何修改涉及 `postMessage` 指令或 `config.js` 全域配置時，必須同步執行跨模組回歸測試。
