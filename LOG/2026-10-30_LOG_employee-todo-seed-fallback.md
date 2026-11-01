# 2026-10-30 未登入露出 Mantle 舊種子／根路徑轉址

## Diff／目的

使用者「工作跑掉了／又變之前的了」：未 LINE 登入時 bridge 回空 `deletedIds`，Mantle 灌回 751 補土等種子；舊 `/employee-todo/` 無 bridge。Sheet 真實任務仍在（多已完成）。

## 技術

- `sheet-bridge.js`：`withSeedTombstones`／`emptyDoc` 帶 Mantle seed tombstone
- `/employee-todo/` → 轉址 `modules/projects/employee-todo/`
- 一併帶上派工說明點編輯可改（`Ae=(O||C)`＋外點不關編輯卡）
- `et-build=20261029g`

## Sheet 對照（唯讀）

- 相對 `dispatch_tasks_backup_20261029_1135`：**無缺列**（備份 id 皆在現表）
- 進行中僅 2：`799雪婷 施作保護工程`、`785 申退／把手／鋁框門`
- 其餘多為已完成；種子 id 在 `deleted_ids`（不救測資）

## 驗證

- [ ] live `et-build=20261029g`
- [ ] 未登入 `?role=ende` 不再出現 751 補土／帶 PP 板
- [ ] `/employee-todo/?role=ende` 轉到 modules
