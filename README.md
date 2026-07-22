# EtheReal Discord Bot（模組化版）

## 檔案結構

- `index.js`：啟動 Bot
- `src/coreBot.js`：原本的活躍、語音 XP、占卜、排行榜、成就與離開通知
- `src/registration.js`：角色登記、下拉選單、自動改名與 Google Sheets 同步

## Northflank 環境變數

請保留／確認：

- `DISCORD_TOKEN`
- `SHEET_ID`
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

## 登記系統使用的 Discord ID

- 成員身分組：`1487394336462209144`
- 登記面板頻道：`1487061918182015096`
- 登記紀錄頻道：`1529519154439258334`

## Google Sheets

Bot 第一次使用角色登記時，會自動建立 `角色登記` 分頁與標題列，不需要手動建立。

原本的 `工作表1` 不會被更名或刪除。

## 上傳方式

將此資料夾內全部檔案上傳至 GitHub 專案根目錄，取代原本只有單一 `index.js` 的版本，然後讓 Northflank 重新部署。

Northflank 啟動指令：

```bash
npm start
```

## 測試

部署完成後測試：

- `-等級`
- `-排行榜`
- `-占卜`
- `-登記角色`

機器人要能修改成員暱稱，Bot 的身分組必須高於一般成員身分組，並具有「管理暱稱」權限。
