# 2026-07-28 LOG — SketchUp 渲染工作室權限改 ≥ 2

## Diff／目的

HUB 入口與後端認證門檻由 ≥ 3 降為 ≥ 2，權限 2 即可使用渲染工作室（FB／AI 實驗室仍 ≥ 3）。

## 技術

| 位置 | 變更 |
|------|------|
| `spa/Dashboard.js` | 卡片 `permission >= 2`；**補回** `return` 暴露 `sketchupRenderStudioPublicUrl`／複製函式（先前漏暴露導致開啟連結無效） |
| `SPEC/23_SKETCHUP_RENDER_STUDIO_SPEC.md`、`專案完整檔案清冊.md` | 門檻文件同步 |
| accounting-gas | `resolveSketchupRenderAuth_`（見後端 LOG） |

## 驗證

1. 權限 2 帳號：HUB 可見「SketchUp 渲染工作室」卡片  
2. 「開啟網站」應開 `https://info.tanxin.space/tools/sketchup-render-studio/`（非空連結）  
3. 開啟工具後 ping／單張渲染可過認證（不再出現需 ≥ 3）  
4. 權限 1 仍不可見／不可用  

## 部署

- CODING：僅推送本變更（`Dashboard.js`／SPEC／本 LOG）；未含工作區其他選材 WIP
- accounting-gas：**@239**（見後端 LOG）
- 補修連結：`aff2a7a`（漏 return 暴露）
- 再修：HUB「開啟網站」改 `liff.openWindow({ external: true })`（LINE 內 `_blank` 常無反應）
