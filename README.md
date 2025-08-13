# 元心建材工程管理系統

## 系統概述

基於 Cloudflare Workers + D1 + Pages 的現代化工程管理系統，提供專案管理、團隊協作、進度追蹤等功能。

## 🚀 快速開始

### 當前認證方式
- **登入頁面**: `login-simple.html`
- **測試帳號**: 0912345678 / 678 (管理員)
- **詹姆士帳號**: 0963922033 / 033 (管理員)

### 系統連結
- **前端**: https://construction-management-frontend.pages.dev
- **API**: https://construction-d1-api.lai-jameslai.workers.dev
- **健康檢查**: https://construction-d1-api.lai-jameslai.workers.dev/health

## 📁 專案結構

```
├── frontend/                 # 前端文件
│   ├── login-simple.html    # 登入頁面
│   ├── project-list.html    # 專案列表
│   ├── project-detail.html  # 專案詳情
│   ├── project-create.html  # 專案建立
│   ├── project-edit.html    # 專案編輯
│   ├── cleanup-storage.html # 儲存清理工具
│   ├── setup-admin.html     # 管理員設定
│   ├── js/
│   │   ├── unified-auth.js  # 統一認證系統
│   │   ├── auth-utils.js    # 向後相容介面
│   │   └── api-client.js    # API 客戶端
│   └── config.js            # 系統配置
├── workers/                 # Cloudflare Workers
│   ├── src/index.js        # API 主程式
│   ├── wrangler.toml       # Workers 配置
│   └── schema-engineering.sql # 資料庫結構
└── docs/                    # 文件目錄
    └── authentication-system.md # 認證系統文件
```

## 🔐 認證系統

### 當前使用: 簡單認證
- 手機號碼 + 末3碼密碼
- 適用於開發/測試環境
- 登入頁面: `login-simple.html`

### 未來規劃: Clerk 認證
- 第三方認證服務
- 更強的安全性
- 登入頁面: `login-clerk.html` (已準備)

**切換方式**: 只需要更改入口頁面連結，從 `login-simple.html` 改為 `login-clerk.html`

詳細說明請參考: [認證系統文件](docs/authentication-system.md)
[![Cloudflare D1](https://img.shields.io/badge/Cloudflare-D1-blue)](https://developers.cloudflare.com/d1/)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-green)](https://pages.cloudflare.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 專案概述

元心建材工程管理系統是一個專為建築工程施工進度追蹤和管理而設計的現代化 SaaS 平台，採用 Cloudflare 全棧技術架構，提供高效能、全球化的工程管理解決方案。

### ✨ 核心特色

- 🏗️ **專案管理** - 多專案總覽儀表板，即時追蹤所有工程進度
- 📊 **施工進度矩陣** - 視覺化的樓層×戶別網格展示
- 📸 **照片記錄** - 施工前後照片上傳與雲端管理
- 👥 **工班管理** - 統一權限控制和工班狀態追蹤
- 🔒 **權限系統** - 基於角色的精細化權限控制
- 📱 **響應式設計** - 支援桌面端和行動端操作
- 🌍 **全球部署** - 基於 Cloudflare Edge Network

## 🚀 快速開始

### 先決條件

```bash
# 安裝最新版 Wrangler CLI
npm install -g wrangler@latest

# 確認版本 (必須 >= 4.0)
wrangler --version
```

### 安裝與部署

```bash
# 1. 複製專案
git clone https://github.com/jameslai-sparkofy/construction-management-system.git
cd construction-management-system

# 2. 安裝依賴
cd workers && npm install

# 3. 部署資料庫
wrangler d1 execute DB_ENGINEERING --remote --file=schema-final.sql

# 4. 部署 Worker API
wrangler deploy src/index.js --name construction-management-api-clerk

# 5. 建立示範資料
curl -s "https://api.yes-ceramics.com/create-demo"
```

### 驗證部署

```bash
# 健康檢查
curl -s "https://api.yes-ceramics.com/health"

# 查看示範專案
curl -s "https://api.yes-ceramics.com/api/v1/projects/650fe201d184e50001102aee"
```

## 🏛️ 技術架構

### 技術棧
- **後端**: Cloudflare Workers (Serverless Edge Computing)
- **資料庫**: Cloudflare D1 (分散式 SQLite)
- **前端**: Cloudflare Pages (靜態網站託管)
- **儲存**: R2 (物件儲存) + KV (鍵值儲存)
- **CDN**: Cloudflare Global Network (200+ 節點)

### 架構優勢
- ⚡ **零冷啟動** - V8 Isolate 技術
- 🌍 **全球分散** - 200+ 邊緣節點
- 💰 **成本最佳化** - 按需付費模式
- 🔒 **內建安全** - DDoS + WAF 防護
- 📈 **自動擴展** - 無需容量規劃

## 📊 資料庫設計

### 核心理念
採用**混合式設計**，結合關聯式資料庫的嚴謹性與 NoSQL 的靈活性：

- **統一權限管理** - 單一表格管理工班和業主權限
- **JSON 彈性欄位** - 適應業務需求變化
- **雙資料庫架構** - 業務資料與 CRM 資料分離

### 主要表格
- `projects` - 專案主表 (混合 JSON + 關聯式)
- `project_members` - 統一權限管理 ⭐
- `users` - 使用者資料 (工班 + 業主)
- `construction_sites` - 案場資料
- `project_activity_logs` - 操作稽核

## 🌐 API 接口

### 基礎資訊
- **Base URL**: https://api.yes-ceramics.com
- **版本**: v1
- **認證**: 手機號碼 + 後三碼密碼
- **格式**: JSON

### 主要端點
```bash
# 認證
POST /api/v1/auth/login

# 專案管理  
GET  /api/v1/projects/{id}
POST /api/v1/projects
PUT  /api/v1/projects/{id}

# 權限檢查
GET  /api/v1/permissions/{projectId}/{userId}

# CRM 同步
POST /api/v1/sync/teams
POST /api/v1/sync/owners

# 系統狀態
GET  /health
GET  /create-demo
```

## 📱 前端架構

### 技術選型
- **基礎**: HTML5 + CSS3 + Vanilla JavaScript
- **設計**: 響應式設計，支援 PWA
- **打包**: 無打包工具 (輕量化)
- **部署**: Cloudflare Pages

### 主要頁面
- `index.html` - 登入頁面
- `project-list.html` - 專案列表
- `project-detail-v5-final.html` - 專案詳情
- `project-create-v2.html` - 專案建立

## 📚 文檔結構

詳細技術文檔請參考 [`docs/`](./docs/) 目錄：

### 🏛️ [系統架構](./docs/architecture/)
- [系統架構總覽](./docs/architecture/system-overview.md)
- [統一權限設計](./docs/architecture/unified-permissions.md)

### 🗄️ [資料庫設計](./docs/database/)
- [資料庫設計總覽](./docs/database/schema-overview.md)
- [表格結構詳解](./docs/database/tables.md)

### 🔌 [API 文檔](./docs/api/)
- [API 總覽](./docs/api/overview.md)
- [認證系統](./docs/api/authentication.md)

### 🌐 [前端文檔](./docs/frontend/)
- [前端架構](./docs/frontend/architecture.md)
- [API 整合](./docs/frontend/api-integration.md)

### 🚀 [部署指南](./docs/deployment/)
- [部署指南](./docs/deployment/guide.md)
- [故障排除](./docs/deployment/troubleshooting.md)

## 🌐 線上服務

- **🔗 API 服務**: https://api.yes-ceramics.com
- **📊 示範專案**: 興安西 (ID: `650fe201d184e50001102aee`)
- **📖 GitHub**: https://github.com/jameslai-sparkofy/construction-management-system

### 示範資料
- **專案**: 興安西建案
- **工班**: 3 個工班 (陳師傅、林師傅、王師傅團隊)
- **業主**: 3 位業主 (張美玲、李文華、黃秀英)

## 🔧 本地開發

### 開發環境設置
```bash
# 1. 進入 workers 目錄
cd workers

# 2. 啟動本地開發服務器
wrangler dev --port 8787

# 3. 測試本地 API
curl "http://localhost:8787/health"
```

### 資料庫操作
```bash
# 本地資料庫初始化
wrangler d1 execute DB_ENGINEERING --file=schema-final.sql

# 查看資料庫內容
wrangler d1 execute DB_ENGINEERING --command "SELECT * FROM projects LIMIT 5"

# 同步到遠端資料庫
wrangler d1 execute DB_ENGINEERING --remote --file=schema-final.sql
```

## 🧪 測試

### API 測試
```bash
# 健康檢查
curl -s "https://api.yes-ceramics.com/health"

# 建立示範資料
curl -s "https://api.yes-ceramics.com/create-demo"

# 查詢專案
curl -s "https://api.yes-ceramics.com/api/v1/projects/650fe201d184e50001102aee"
```

### 前端測試
系統支援 Playwright 自動化測試：
```bash
cd frontend
npm install
npx playwright test
```

## 📈 監控與維運

### 效能監控
```bash
# Worker 即時日誌
wrangler tail construction-management-api-clerk

# 資料庫狀態
wrangler d1 info DB_ENGINEERING

# 部署狀態
wrangler deployments list construction-management-api-clerk
```

### 關鍵指標
- **API 回應時間**: < 100ms (邊緣節點)
- **資料庫查詢**: < 50ms (D1 優化)
- **前端載入**: < 2s (CDN 快取)
- **可用性**: 99.9% (Cloudflare SLA)

## 📋 更新日誌

### v1.0.0 (2025-08-11) - 系統整合完成 🎉
- ✅ **架構升級**: 完整 Cloudflare 全棧整合
- ✅ **統一權限**: 創新的權限管理設計
- ✅ **資料庫**: 7 個核心表格，混合式設計
- ✅ **API 服務**: 完整 REST API，自訂域名
- ✅ **前端整合**: 響應式設計，API 無縫整合
- ✅ **部署優化**: Wrangler CLI v4.28.1 升級
- ✅ **示範資料**: 興安西完整測試資料

### 重要技術改進
- **Wrangler CLI 升級**: 解決部署靜默問題
- **D1 SQL 優化**: 修復約束語法錯誤
- **Route 配置**: 自訂域名穩定運行
- **CORS 支援**: 完整跨域請求支援

## 🤝 貢獻指南

歡迎參與專案開發！請遵循以下步驟：

1. **Fork** 本專案
2. 創建您的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的變更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟一個 **Pull Request**

### 開發規範
- 遵循現有程式碼風格
- 確保所有測試通過
- 更新相關文檔
- 詳細描述變更內容

## 📞 支援與聯絡

### 問題回報
- **GitHub Issues**: [提交問題](https://github.com/jameslai-sparkofy/construction-management-system/issues)
- **故障排除**: 參考 [故障排除指南](./docs/deployment/troubleshooting.md)

### 技術支援
- **文檔**: 完整技術文檔位於 [`docs/`](./docs/) 目錄
- **範例**: 線上示範專案和 API 範例
- **社群**: GitHub Discussions

## 📄 開源協議

本專案採用 MIT 協議授權 - 詳情請見 [LICENSE](LICENSE) 檔案

## 🙏 致謝

感謝所有參與專案開發的貢獻者，以及以下技術和服務提供商：

- [Cloudflare](https://cloudflare.com/) - 提供全棧雲端解決方案
- [紛享銷客](https://www.fxiaoke.com/) - CRM 系統整合支援
- 所有測試使用者和意見回饋者

---

**版本**: v1.0.0 | **最後更新**: 2025-08-11 | **維護者**: [James Lai](https://github.com/jameslai-sparkofy)

**⭐ 如果這個專案對您有幫助，請給我們一個 Star！**