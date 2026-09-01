# NOX Offline Player

NOX 是一個以瀏覽器為核心的本機影音播放器原型，目標是在不把影片、音訊或字幕上傳到雲端的前提下，提供播放、字幕載入、語言設定與本機語音模型處理能力。

## 隱私定位

本專案採用「完全不接雲端 AI」方向。影片與音訊應留在使用者裝置上；雲端 AI 連線不屬於本版本的必要流程。實際離線語音辨識能力仍須在瀏覽器與裝置上下載模型後驗證，模型下載本身可能需要網路，下載完成後才可嘗試離線處理。

## 開發環境

- Node.js 18 或更新版本
- npm
- 支援現代 JavaScript 的瀏覽器

## 安裝與啟動

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

啟動後，使用瀏覽器開啟終端機顯示的本機網址；預設開發伺服器埠號為 `8080`。

## 可用指令

| 指令 | 用途 |
|---|---|
| `npm run dev` | 啟動開發伺服器 |
| `npm run typecheck` | 執行 TypeScript 型別檢查 |
| `npm run build` | 建立正式版本 |
| `npm run lint` | 執行 ESLint |
| `npm test` | 執行測試 |

## 目前狀態

這是從既有工作區整理出的原型。正式建置與型別檢查可以執行；部分既有的 Grok 平台擴充測試仍會失敗，與播放器核心功能及離線模型流程分開處理。

## GitHub 注意事項

請勿提交 `.env`、API 金鑰、瀏覽器登入資料、`node_modules`、`.vercel` 或 Android 建置產物。專案根目錄的 `.gitignore` 已包含這些排除規則。
