# WME List

黃名帝國官職表獨立網頁。

## 頁面

- `privy.html`：司憲院制司受憲秘閣院職官表
- `privy-data.js`：內建初始資料

## 雲端同步

頁面保留原本 JSONBin 的 Bin ID 與 `savedHTML` 資料格式，因此原有雲端資料可直接讀取，不需要重新建立資料。

編輯流程仍為：右上角 ⚙️ → 管理員驗證 → 編輯 → 失焦自動寫回雲端。

> 注意：原始頁面把 JSONBin Master Key 直接放在前端 JavaScript。此方式可延續舊頁面的無縫相容性，但 Master Key 對瀏覽器使用者並非真正保密。若之後要公開長期使用，建議改成後端 API / Serverless Function，由伺服器保存密鑰。
