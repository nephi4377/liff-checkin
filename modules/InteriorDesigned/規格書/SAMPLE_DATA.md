# 測試用範例資料 (Sample Data)

初始化 Google Sheet 後，請將以下資料複製貼上至對應的分頁，以進行完整功能測試。

## 分頁 1: DB_Materials
| mat_id | category | name | spec_order | brand | unit | vendor_ref | price_estimate | pack_desc |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| m_silicate_6 | 板材 | 矽酸鈣板 | 3x6尺 6mm | 日本麗仕 | 張 | 建材行A | 320 | |
| m_timber_lv | 角材 | 集層角材 | 8尺 (1寸2) | 永新F1 | 支 | 建材行A | 65 | 一捆10支 |
| m_glue_w | 五金 | 強力白膠 | 3kg 包 | 南寶 | 包 | 五金行B | 150 | 一箱6包 |
| m_protect_b | 保護 | PP瓦楞板 | 3x6尺 | 一般 | 張 | 建材行A | 25 | 一捆20張 |

## 分頁 2: DB_Tools
| tool_id | category | name | power_spec | alloc_rule | storage_box |
| :--- | :--- | :--- | :--- | :--- | :--- |
| t_comp_2hp | 電動工具 | 2HP空壓機 | 110V | Site | 倉庫 |
| t_nail_f50 | 氣動工具 | F50單針氣釘槍 | Air | Site | 工具箱A |
| t_nail_422 | 氣動工具 | 422雙腳氣釘槍 | Air | Site | 工具箱A |
| t_level | 手工具 | 水平尺 (60cm) | | Worker | 隨身 |
| t_tape | 保護 | 養生膠帶 (2700) | | Dynamic | 耗材區 |

## 分頁 3: DB_Tasks
| task_id | category | phase | task_name | unit | labor_cost | sop_construction | inspection_key | inspection_sample |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| protect_floor | 保護 | 01_保護 | 地板保護工程(兩層) | 坪 | 500 | 第一層瓦楞板... | 走道重疊處需黏貼牢固 | 無 |
| ceiling_flat | 木作 | 03_木作 | 平釘天花板 | 坪 | 1200 | 吊筋間距90cm... | 吊筋拉力測試 | 表面水平度 |
| part_wall | 木作 | 03_木作 | 隔間牆 (單面) | 尺 | 800 | 立柱間距30cm | 結構穩固搖晃測試 | 板材接縫 |

## 分頁 4: Map_Task_Materials
| task_id | mat_id | spec | qty_per_unit | loss_rate | is_consumable | linked_tool_id |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| protect_floor | m_protect_b | 雙層保護 | 2.0 | 1.1 | FALSE | t_tape |
| ceiling_flat | m_silicate_6 | 6mm | 1.0 | 1.15 | FALSE | |
| ceiling_flat | m_timber_lv | 骨架 | 12.0 | 1.1 | FALSE | t_nail_f50 |
| ceiling_flat | m_glue_w | 接著 | 0.2 | 1.2 | TRUE | |

## 分頁 5: Map_Task_Tools
| task_id | tool_id | type | qty_avg | calc_method |
| :--- | :--- | :--- | :--- | :--- |
| protect_floor | t_tape | 必備 | 0.5 | PerUnit |
| ceiling_flat | t_comp_2hp | 必備 | 1 | Fixed |
| ceiling_flat | t_nail_f50 | 必備 | 1 | Fixed |
| ceiling_flat | t_level | 必備 | 1 | Fixed |
