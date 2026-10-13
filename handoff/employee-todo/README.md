# employee-todo → tanxin02 轉運 patch（最新 mist）

內容：工務三色分區、「誰派的」下拉、晨霧視覺、預設 MantleDB 同步（僅 `?demo=1` 用假資料）。

## 套用並推上 tanxin02（有 write 的帳號）

```bash
git clone https://github.com/tanxin02/employee-todo.git
cd employee-todo
curl -L -o worker-ui.diff \
  https://raw.githubusercontent.com/nephi4377/liff-checkin/cursor/employee-todo-patch-dbc5/handoff/employee-todo/worker-ui.diff
git checkout -b cursor/worker-category-colors-dbc5
git apply worker-ui.diff
git add -A
git commit -m "Mist worker UI: categories, assigner dropdown, MantleDB sync"
git push -u origin cursor/worker-category-colors-dbc5
```

開 PR → merge → 依 HANDOFF 更新 `gh-pages`。

正式站同步：MantleDB `yang-employee-todo-1791806583`（內建於 `src/sync/config.ts`，無需另填）。
