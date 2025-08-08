# 工程管理系統 - Construction Management System

## 🏗️ 專案簡介

本系統是一個基於 Cloudflare Workers 的建築工程管理平台，整合紛享銷客 CRM 資料，提供施工進度追蹤、人員權限管理、施工照片上傳等功能。

## 🎯 核心功能

- **雙資料庫架構**：CRM資料（fx-crm-database）與專案管理（engineering-management）分離
- **多工程類型支援**：SPC石塑地板、浴櫃工程
- **權限管理系統**：角色基礎存取控制（Admin/Owner/Leader/Member）
- **視覺化樓層矩陣**：直觀顯示施工進度
- **照片管理**：整合 R2 儲存施工照片
- **手機登入**：手機號碼 + 末3碼密碼認證

## 🚀 快速開始

### 前置要求

- Node.js 18+
- Cloudflare 帳戶
- 紛享銷客 API 憑證
- Wrangler CLI

### 環境設定

1. **克隆專案**
```bash
git clone <repository-url>
cd fx-crm-sync
```

2. **安裝依賴**
```bash
cd workers
npm install
```

3. **設定 Cloudflare 憑證**
```bash
wrangler login
```

4. **創建資源**
```bash
# D1 資料庫已存在，不需重新創建
# fx-crm-database: 332221d8-61cb-4084-88dc-394e208ae8b4
# engineering-management: 21fce5cd-8364-4dc2-be7f-6d68cbd6fca9

# 創建 KV 命名空間（如尚未創建）
wrangler kv:namespace create "SESSION_STORE"
wrangler kv:namespace create "SYNC_STATE"

# 創建 R2 儲存桶（如尚未創建）
wrangler r2 bucket create construction-photos
```

5. **初始化資料庫**
```bash
# 初始化工程管理資料庫
wrangler d1 execute engineering-management --file=./schema-engineering.sql
```

6. **設定環境變數**
```bash
# 設定 API 密鑰
wrangler secret put FX_API_TOKEN
# 輸入: fx-crm-api-secret-2025

wrangler secret put JWT_SECRET
# 輸入: 你的JWT密鑰
```

### 本地開發

```bash
cd workers
npm run dev
```

訪問 http://localhost:8787

### 部署到 Cloudflare

```bash
cd workers
npm run deploy
```

## 📁 專案結構

```
fx-crm-sync/
├── workers/                    # Cloudflare Workers 後端
│   ├── src/
│   │   ├── index.js           # 主入口
│   │   ├── models/            # 資料模型
│   │   ├── services/          # 業務邏輯
│   │   ├── utils/             # 工具函數
│   │   └── middleware/        # 中間件
│   ├── schema-engineering.sql # 工程管理資料庫結構
│   ├── wrangler.toml          # Cloudflare 設定
│   └── package.json
├── frontend/                   # 前端頁面
│   ├── login.html             # 登入頁面
│   ├── project-list.html      # 專案列表
│   ├── project-create-v2.html # 專案創建（4步驟）
│   ├── project-details.html   # 專案詳情
│   └── team-management.html   # 人員管理
└── 工程管理/                   # 文檔與設計
    ├── CRM欄位對照表.md       # CRM欄位映射
    ├── schema-complete.sql     # 完整資料庫結構
    └── 專案說明書.md          # 專案說明文檔
```

## 🔧 API 端點

### 認證
- `POST /api/v1/auth/login` - 登入
- `POST /api/v1/auth/logout` - 登出
- `GET /api/v1/auth/me` - 獲取當前用戶

### 專案管理
- `GET /api/v1/projects` - 專案列表
- `POST /api/v1/projects` - 創建專案
- `GET /api/v1/projects/:id` - 專案詳情
- `GET /api/v1/projects/:id/sites` - 專案案場列表

### CRM 資料存取
- `GET /api/v1/crm/opportunities` - 商機列表
- `GET /api/v1/crm/sites` - 案場列表
- `PUT /api/v1/crm/sites/:id` - 更新案場資料

### 檔案上傳
- `POST /api/v1/upload` - 上傳施工照片到 R2

## 🗄️ 資料庫架構

### fx-crm-database (CRM資料)
- `object_8w9cb__c` - SPC案場資料
- `site_cabinet__c` - 浴櫃案場資料
- `opportunity__c` - 商機資料

### engineering-management (專案管理)
- `projects` - 專案資料
- `users` - 使用者資料
- `project_permissions` - 權限設定

## 🔐 安全性

- JWT Token 認證
- 角色基礎存取控制
- API Token 保護
- CORS 設定
- 環境變數加密儲存

## 📝 部署檢查清單

- [ ] 設定 Cloudflare API Token
- [ ] 創建 D1 資料庫
- [ ] 創建 KV 命名空間
- [ ] 創建 R2 儲存桶
- [ ] 設定環境變數
- [ ] 初始化資料庫結構
- [ ] 部署 Workers
- [ ] 設定自訂網域（可選）
- [ ] 啟用 Cloudflare WAF（建議）

## 🛠️ 維護指令

```bash
# 查看日誌
wrangler tail

# 備份資料庫
wrangler d1 execute engineering-management --command="SELECT * FROM projects" > backup.json

# 清理過期 Session
wrangler kv:key list --namespace-id=<SESSION_STORE_ID> | xargs -I {} wrangler kv:key delete {} --namespace-id=<SESSION_STORE_ID>
```

## 📞 支援

如有問題，請參考專案文檔或聯繫開發團隊。

## 📄 授權

專有軟體 - 元心建材