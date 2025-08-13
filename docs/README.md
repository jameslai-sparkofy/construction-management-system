# 元心建材工程管理系統 - 技術文檔

## 📖 文檔概覽

這是元心建材工程管理系統的完整技術文檔，包含系統架構、API 接口、資料庫設計等重要資訊。

## 🏗️ 系統架構

**技術棧**: Cloudflare Workers + D1 + Pages + R2 全棧解決方案

- **後端**: Cloudflare Workers (Serverless)
- **資料庫**: Cloudflare D1 (SQLite)
- **前端**: Cloudflare Pages (靜態網站)
- **儲存**: R2 (檔案) + KV (快取)

## 🚀 快速開始

1. **開發環境設置**
   ```bash
   # 安裝最新版 Wrangler CLI (重要!)
   npm install -g wrangler@latest
   
   # 複製儲存庫
   git clone https://github.com/jameslai-sparkofy/construction-management-system.git
   cd construction-management-system
   
   # 安裝依賴
   cd workers && npm install
   cd ../frontend && npm install
   ```

2. **資料庫初始化**
   ```bash
   # 執行 schema 建立
   wrangler d1 execute DB_ENGINEERING --file=schema-final.sql --remote
   
   # 建立示範資料
   curl -s "https://api.yes-ceramics.com/create-demo"
   ```

## 📚 文檔索引

### 🏛️ 系統架構
- [系統架構總覽](./architecture/system-overview.md)
- [統一權限設計](./architecture/unified-permissions.md)
- [部署架構](./architecture/deployment.md)

### 🗄️ 資料庫
- [資料庫設計總覽](./database/schema-overview.md)
- [表格結構詳解](./database/tables.md)
- [統一權限設計](./database/permissions.md)
- [遷移指南](./database/migrations.md)

### 🔌 API 接口
- [API 總覽](./api/overview.md)
- [認證系統](./api/authentication.md)
- [專案管理 API](./api/projects.md)
- [CRM 同步 API](./api/sync.md)
- [錯誤處理](./api/errors.md)

### 🌐 前端
- [前端架構](./frontend/architecture.md)
- [頁面結構](./frontend/pages.md)
- [API 整合](./frontend/api-integration.md)
- [測試指南](./frontend/testing.md)

### 🚀 部署
- [部署指南](./deployment/guide.md)
- [環境配置](./deployment/environment.md)
- [故障排除](./deployment/troubleshooting.md)
- [監控與日誌](./deployment/monitoring.md)

## 🌐 線上服務

- **API 服務**: https://api.yes-ceramics.com
- **前端網站**: (Cloudflare Pages)
- **GitHub**: https://github.com/jameslai-sparkofy/construction-management-system

## 🔑 關鍵資訊

### 現有示範資料
- **專案**: 興安西 (ID: 650fe201d184e50001102aee)
- **工班**: 3個 (陳師傅、林師傅、王師傅團隊)
- **業主**: 3個 (張美玲、李文華、黃秀英)

### 重要 Cloudflare 資源
- **Worker**: construction-management-api-clerk
- **D1 資料庫**: engineering-management (DB_ENGINEERING)
- **自訂域名**: api.yes-ceramics.com
- **Route ID**: 0cfbfafad8e245d3bdba145a6a54c788

## 📝 更新日誌

### 2025-08-11 - 系統整合完成
- ✅ 統一權限系統實作完成
- ✅ D1 資料庫 schema 部署 (7個核心表格)
- ✅ 自訂域名 API 服務上線
- ✅ 前後端整合測試通過
- ✅ Wrangler CLI 升級至 v4.28.1

## 🤝 貢獻指南

1. 閱讀相關技術文檔
2. 在 `feature/*` 分支開發
3. 確保所有測試通過
4. 提交 Pull Request

## 📞 支援

如有技術問題，請：
1. 查閱相關文檔
2. 檢查 [故障排除指南](./deployment/troubleshooting.md)
3. 提交 GitHub Issue

---

**最後更新**: 2025-08-11  
**系統版本**: v1.0.0  
**技術棧**: Cloudflare Workers + D1 + Pages