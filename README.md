# 工程進度管理系統 - Construction Management System

元心建材工程進度管理系統，專為建築工程施工進度追蹤和管理而設計的 SaaS 平台。

## 🏗️ 功能特色

- **專案管理**：多專案總覽儀表板，即時追蹤所有工程進度
- **施工進度矩陣**：視覺化的樓層×戶別網格展示
- **照片記錄**：施工前後照片上傳與管理
- **工班管理**：工班權限控制和施工狀態追蹤
- **多租戶架構**：每個專案獨立 URL 和資料隔離

## 🚀 技術架構

- **前端**：HTML5 + CSS3 + JavaScript (準備整合 Vue.js)
- **後端**：Cloudflare Workers (邊緣運算)
- **資料庫**：Cloudflare D1 (fx-crm-database)
- **檔案儲存**：Cloudflare R2
- **認證**：JWT + Workers KV Session

## 📁 專案結構

```
工程管理/
├── frontend/              # 前端檔案
│   ├── login.html        # 登入頁面
│   ├── project-list-integrated.html  # 專案列表
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

## 🏁 快速開始

### 前置需求
- Node.js 18+
- Cloudflare 帳號

### 安裝步驟

```bash
# 1. 克隆專案
git clone https://github.com/your-username/construction-management.git
cd construction-management

# 2. 進入 Workers 目錄
cd workers

# 3. 安裝依賴
npm install

# 4. 執行設置腳本
npm run setup

# 5. 啟動開發服務器
npm run dev
```

### 測試帳號
- 手機：0912345678
- 密碼：678

## 📖 文檔

- [快速開始指南](QUICK-START.md)
- [部署指南](workers/DEPLOYMENT-GUIDE.md)
- [API 文檔](workers/README.md)

## 🔧 開發命令

| 命令 | 說明 |
|------|------|
| `npm run dev` | 啟動開發服務器 |
| `npm run deploy` | 部署到 Cloudflare |
| `npm run test:api` | 測試 API |
| `npm run tail` | 查看日誌 |

## 🌐 API 端點

### 認證
- `POST /api/v1/tenant/:tenantId/auth/login` - 登入
- `GET /api/v1/tenant/:tenantId/auth/profile` - 用戶資料

### 專案管理
- `GET /api/v1/tenant/:tenantId/projects` - 專案列表
- `POST /api/v1/tenant/:tenantId/projects` - 創建專案

### 檔案管理
- `POST /api/v1/tenant/:tenantId/files/upload` - 上傳照片
- `GET /api/v1/tenant/:tenantId/files/:fileId` - 取得檔案

## 🔒 安全性

- 手機號碼 + 密碼認證
- JWT Token 驗證
- 多租戶資料隔離
- CORS 保護

## 📝 授權

MIT License

## 👥 團隊

元心建材工程管理團隊

---

Built with ❤️ using Cloudflare Workers