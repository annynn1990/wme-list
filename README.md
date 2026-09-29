# WME List

黃名帝國官職表獨立網頁。

## 頁面

- `privy.html`：司憲院制司受憲秘閣院職官表
- `privy-data.js`：內建初始資料

## 資料儲存

- `data.json` 是唯一資料來源，直接存放在 Git repository。
- 網頁從 GitHub Pages 的 `data.json` 讀取資料。
- 不再使用 JSONBin，也不再依賴任何外部資料庫。
- Git commit 本身就是資料版本紀錄。

## 編輯

右上角 ⚙️ 驗證後會開啟 GitHub 的 `data.json` 編輯頁。修改並 Commit 後，GitHub Pages 重新部署，網站就會讀到最新資料。

