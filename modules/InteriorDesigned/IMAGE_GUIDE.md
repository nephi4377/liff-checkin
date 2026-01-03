# 圖片管理指南

## Dropbox 圖片使用方式

### 步驟 1: 上傳圖片到 Dropbox

1. 將圖片放入此資料夾: `d:\Dropbox\CodeBackups\CODING\modules\InteriorDesigned\images\`
2. 等待 Dropbox 同步完成

### 步驟 2: 取得公開連結

1. 在 Dropbox 網頁版 (https://www.dropbox.com) 開啟圖片
2. 點擊「共用」→「建立連結」
3. 複製連結,格式類似:
   ```
   https://www.dropbox.com/s/abc123xyz/sofa.png?dl=0
   ```

### 步驟 3: 轉換為直接存取連結

將連結中的 `?dl=0` 改為 `?raw=1`:

**轉換前**:
```
https://www.dropbox.com/s/abc123xyz/sofa.png?dl=0
```

**轉換後**:
```
https://www.dropbox.com/s/abc123xyz/sofa.png?raw=1
```

### 步驟 4: 填入 Google Sheets

將轉換後的連結填入 Google Sheets 的「圖片網址」欄位。

---

## GitHub 圖片使用方式 (未來)

未來上傳到 GitHub 後,可使用 raw 連結:

```
https://raw.githubusercontent.com/使用者名稱/專案名稱/main/images/sofa.png
```

---

## 本地伺服器使用方式 (僅限本機測試)

如果只在本機使用,可以使用本地伺服器路徑:

```
http://127.0.0.1:8000/images/sofa.png
```

**注意**: 此方式只能在本機使用,無法分享給其他人。

---

## 圖片建議

### 檔案格式
- **PNG**: 適合有透明背景的圖示
- **JPG**: 適合照片
- **SVG**: 適合向量圖形 (最佳)

### 檔案大小
- 建議每張圖片 < 500KB
- 過大的圖片會影響載入速度

### 命名規則
- 使用英文或數字
- 避免空格和特殊字元
- 範例: `cabinet_60cm.png`, `sofa_3seat.jpg`
