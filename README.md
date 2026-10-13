# 員工代辦事項

本機連結 **羊** 為行政助理：派工給工務、調整優先／代辦順序；工務以通行碼進入工務模式勾選完成。

## 安裝方式

| 平台 | 方式 |
|------|------|
| Android | Capacitor debug APK：`npm run android:apk` |
| iPhone | Safari「加入主畫面」（PWA）；或在 **Mac + Xcode** 開啟 `ios/`（Linux 無法簽 IPA） |
| 網頁 | `npm run dev` |

詳見 Agent Store `docs/how-to-run.md`。

## 開發

```bash
npm install
npm run dev
npm run android:apk   # 需 ANDROID_HOME
npm run ios:sync      # 同步到 ios/；請在 macOS 執行 npx cap open ios
```
