# 國民大街住戶列表

黃名帝國「國民大街住戶列表」獨立網站。

## 頁面

- `index.html)：住戶列表首頁
- `data.json)：唯一的雲端資料來源

## 資料儲存

住戶資料直接儲存在 GitHub repository 的 `data.json`，不使用 `localStorage`。

網站載入時會從：

`https://annynn1990.github.io/wme-list/data.json`

讀取最新資料。

## 修改住宅名稱與住宅地址

首頁右上角按「✎ 編輯資料」，會開啟 GitHub 的 `data.json` 編輯頁。

資料格式：

```json
{
  "version": 1,
  "updatedAt": "2026-10-08T13:00:00+08:00",
  "households": [
    {
      "id": 1,
      "name": "住宅名稱",
      "address": "住宅地址"
    }
  ]
}
```

修改完成後在 GitHub 按 **Commit changes**。Commit 後 GitHub Pages 會重新發布，網站便會使用新資料。

## 注意

這個版本刻意不把管理用 GitHub Token 放進前端，因此不會把可以寫入 repository 的密鑰公開給訪客。
