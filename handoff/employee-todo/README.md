# employee-todo 轉運 patch

因 Cloud Agent 的 `cursor[bot]` 無法 push 到 `tanxin02/employee-todo`，改動以此 diff 轉運。

## 套用

```bash
git clone https://github.com/tanxin02/employee-todo.git
cd employee-todo
curl -L -o worker-ui.diff \
  https://raw.githubusercontent.com/nephi4377/liff-checkin/cursor/employee-todo-patch-dbc5/handoff/employee-todo/worker-ui.diff
git checkout -b cursor/worker-category-colors-dbc5
git apply worker-ui.diff
git add -A
git commit -m "Improve worker category colors and assigner dropdown"
git push -u origin cursor/worker-category-colors-dbc5
```

內容：工務三色分區（優先／限期件／待處理）＋派工「誰派的」下拉。
