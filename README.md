# NOX

NOX 是一個以瀏覽器為基礎的本機影音播放器，目標是在裝置上播放影片或音訊，並以本機 AI 語音模型產生即時字幕與翻譯。它採用 PWA 設計，可在支援的手機瀏覽器中加入主畫面使用。

## 目前功能

目前版本包含本機影音檔匯入、播放清單、字幕檔載入、字幕顯示、即時播放控制、全螢幕、音量控制、鍵盤快捷鍵、語言切換、模型庫介面，以及 PWA 安裝提示。模型與即時語音辨識流程仍需要在實際瀏覽器和裝置上進一步驗證。

## 技術

- React 19 + TypeScript
- Vite + TanStack Router/Start
- Tailwind CSS
- Zustand
- PWA 安裝與離線使用架構
- 瀏覽器端本機 AI 模型支援

## 本機啟動

```bash
npm install
npm run dev
```

啟動後，在瀏覽器開啟 `http://localhost:8080`。

## 建置檢查

```bash
npm run typecheck
npm run build
npm test
```

## 環境變數

本專案預設不啟用登入與資料庫。若要啟用雲端 AI 或部署環境，請使用未提交至 Git 的 `.env` 檔案；請勿把 API 金鑰直接寫入原始碼或提交到 GitHub。

可參考 `.env.example` 建立本機設定。

## 手機使用

完成部署後，Android 可使用 Chrome 的「加到主畫面」，iPhone 可使用 Safari 的「加入主畫面」。目前專案以 PWA 為主要手機使用方式；原生 Android APK 建置仍屬後續工作，並未隨本專案提供已簽章的安裝檔。

## 專案狀態

這是一個可繼續開發的原型版本。下一階段建議先驗證影片播放、SRT 字幕同步、本機模型下載與即時轉錄，再決定是否製作原生 APK 或加入雲端 AI 後端。
