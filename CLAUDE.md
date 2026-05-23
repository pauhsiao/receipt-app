# 拍卡丘（receipt-app）

皮卡丘主題的拍照記帳 PWA。拍收據照片 → Claude OCR 自動辨識 → 存入 Supabase。

## 技術架構

- **前端**：Vanilla JS + PWA（無框架，單頁應用）
- **部署**：Vercel（自動從 GitHub main branch 部署）
- **資料庫**：Supabase（Auth + PostgreSQL + Storage）
- **OCR**：Claude Haiku (`claude-haiku-4-5-20251001`) via Vercel Serverless Function
- **GitHub**：https://github.com/pauhsiao/receipt-app
- **線上網址**：https://receipt-app-smoky-omega.vercel.app

## 檔案結構

```
receipt-app/
├── index.html        # 主頁面（所有 CSS + HTML 結構）
├── app.js            # 前端邏輯（所有功能）
├── config.js         # Supabase URL/Key + OCR URL（不含 secret）
├── sw.js             # Service Worker（PWA 快取）
├── manifest.json     # PWA manifest
├── vercel.json       # Vercel 設定
├── api/
│   ├── ocr.js        # OCR Serverless Function（用 ANTHROPIC_API_KEY）
│   ├── stock-*.js    # 股票相關 API（目前未使用）
├── icons/            # pikachu.png, icon-192.png, icon-512.png
└── supabase/         # SQL schema 與 migration 腳本
```

## 環境變數（Vercel）

| 變數 | 說明 |
|------|------|
| `ANTHROPIC_API_KEY` | Claude API Key，OCR 用 |

Supabase anon key 是公開的，直接寫在 `config.js`。

## Supabase 設定

- **Project URL**：`https://tprjoipfqitdxbhlyekk.supabase.co`
- **Storage bucket**：`receipts`（存收據圖片）
- **主要 Tables**：`receipts`, `receipt_items`, `groups`, `group_members`
- **主要 RPC**：`get_my_groups`, `create_group_for_me`, `join_group_by_code`

## 主要功能

- 拍照 / 相簿上傳 → OCR 辨識帳單資訊
- 手動輸入帳單
- 帳單依月份分組，可折疊，可整月刪除
- 平分帳單（÷N 計算每人份額）
- 群組功能（8 碼邀請碼加入）
- 統計（今日/本週/本月，多幣別換算）
- 多幣別支援 + 即時匯率（open.er-api.com）

## 開發注意事項

### PWA 快取
每次修改 `app.js` 或 `index.html` 後，**必須同時升級 `sw.js` 的 CACHE 版本號**（`receipt-v10` → `receipt-v11`），否則手機 PWA 不會載入新版。

### iOS 檔案選取
- FAB 選單的 `<input type="file">` 必須放在 body 最底層，不能是 `display:none` 父層的子元素，否則 iOS Safari 不會開啟相機
- 選取檔案後先用 `files[0]` 取出 File 物件，再清 `e.target.value = ''`，順序不能反

### 部署流程
```bash
git add .
git commit -m "描述"
git push  # Vercel 自動部署，約 1 分鐘
```

### 本地沒有 dev server
這是純靜態 PWA + Vercel Functions，本地開發需要用 `vercel dev` 或直接 push 測試。
