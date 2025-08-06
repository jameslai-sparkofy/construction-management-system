# 工程管理系統 - 快速開始指南

## 🚀 5分鐘快速啟動

### 1. 前置需求
- Node.js 18+
- Cloudflare 帳號
- Git

### 2. 快速設置

```bash
# 1. 進入專案目錄
cd /mnt/c/claude\ code/工程管理/workers

# 2. 安裝依賴
npm install

# 3. 執行自動設置腳本
npm run setup

# 4. 啟動開發服務器
npm run dev
```

### 3. 測試系統

開啟瀏覽器訪問：
- **後端 API**: http://localhost:8787/health
- **前端登入**: 開啟 `frontend/login.html`

**測試帳號**：
- 手機：0912345678
- 密碼：678

### 4. 部署到生產環境

```bash
npm run deploy
```

## 📁 專案結構

```
工程管理/
├── frontend/              # 前端檔案
│   ├── login.html        # 登入頁面
│   ├── project-list-integrated.html  # 專案列表（已整合API）
│   └── js/
│       └── api-client.js # API 客戶端
├── workers/              # 後端 Workers
│   ├── src/             # 原始碼
│   ├── scripts/         # 工具腳本
│   └── wrangler.toml    # 配置檔
└── 文檔/
    ├── DEPLOYMENT-GUIDE.md
    └── QUICK-START.md
```

## 🔧 常用命令

| 命令 | 說明 |
|------|------|
| `npm run dev` | 啟動開發服務器 |
| `npm run deploy` | 部署到 Cloudflare |
| `npm run test:api` | 測試 API 功能 |
| `npm run tail` | 查看即時日誌 |

## 🌐 API 端點

### 認證
- `POST /api/v1/tenant/:tenantId/auth/login` - 登入
- `GET /api/v1/tenant/:tenantId/auth/profile` - 取得用戶資料

### 專案管理
- `GET /api/v1/tenant/:tenantId/projects` - 專案列表
- `POST /api/v1/tenant/:tenantId/projects` - 創建專案

### 檔案上傳
- `POST /api/v1/tenant/:tenantId/files/upload` - 上傳施工照片
- `GET /api/v1/tenant/:tenantId/files/:fileId` - 取得檔案

## 🔍 故障排除

### 1. KV namespace 錯誤
```bash
# 重新創建 KV namespaces
npx wrangler kv:namespace create "SESSIONS"
# 更新 wrangler.toml 中的 ID
```

### 2. CORS 錯誤
編輯 `src/index.js`，更新允許的來源：
```javascript
origin: ['http://localhost:3000', 'https://your-domain.com']
```

### 3. 認證失敗
- 確認手機號碼為 10 位數字
- 密碼為手機號碼後 3 碼
- 檢查 session token 是否過期

## 📞 支援

遇到問題？
1. 查看 [部署指南](workers/DEPLOYMENT-GUIDE.md)
2. 檢查 [API 文檔](workers/README.md)
3. 查看日誌：`npm run tail`

---

🎉 **恭喜！** 您已經成功啟動工程管理系統！