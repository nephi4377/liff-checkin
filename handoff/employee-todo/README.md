# employee-todo 轉運 patch

視覺方向：**晨霧工地白板**（冷石灰霧底＋信號色分區：優先紅／限期藍／待處理綠）＋「誰派的」下拉。

## 套用

```bash
git clone https://github.com/tanxin02/employee-todo.git
cd employee-todo
curl -L -o worker-ui.diff \
  https://raw.githubusercontent.com/nephi4377/liff-checkin/cursor/employee-todo-patch-dbc5/handoff/employee-todo/worker-ui.diff
git checkout -b cursor/worker-category-colors-dbc5
git apply worker-ui.diff
git add -A
git commit -m "Improve worker category colors, assigner dropdown, and mist UI"
git push -u origin cursor/worker-category-colors-dbc5
```
