# 檔案追蹤與管理系統
最後更新：2025-08-12

## 🎯 核心檔案（必須保留）

### API Workers
- **主 API**: 
  - 檔案: `/workers/src/index.js`
  - Worker: `construction-management-api-clerk`
  - 域名: `api.yes-ceramics.com`
- **CRM 同步**: 
  - Worker: `fx-crm-sync`
  - 域名: `sync.yes-ceramics.com`
- **D1 REST API**: 
  - Worker: `fx-d1-rest-api`
  - 域名: `d1.yes-ceramics.com`
- **配置**: `/workers/wrangler.toml`

### 前端頁面
| 檔案 | 用途 | URL |
|------|------|-----|
| `/frontend/index.html` | 首頁 | / |
| `/frontend/login.html` | 登入頁 | /login.html |
| `/frontend/project-list.html` | 專案列表 | /project-list.html |
| `/frontend/project-create-v2.html` | 新建專案 | /project-create-v2.html |
| `/frontend/project-detail.html` | 專案詳情 | /project-detail.html |
| `/frontend/config.js` | API 設定 | - |

### 資料庫
- **工程管理**: DB_ENGINEERING (ID: 21fce5cd-8364-4dc2-be7f-6d68cbd6fca9)
- **CRM 資料**: DB_CRM (ID: 332221d8-61cb-4084-88dc-394e208ae8b4)

## 🗑️ 待刪除檔案

### Workers 目錄
```bash
# 備份和舊版本
rm src/index-backup.js
rm src/index-v2.js
rm src/index-v3.js
rm src/test-index.js

# 重複的配置檔案
rm wrangler-final.toml
rm wrangler-simple.toml
rm wrangler-test.toml
rm simple-wrangler.toml
rm wrangler.production.toml

# 測試檔案
rm test-*.js
rm simple-*.js
```

### Frontend 目錄
```bash
# 舊版本和測試檔案
rm -rf 待刪/
rm *-test.html
rm *-test.spec.js
```

## 📝 命名規則

### 新功能開發
1. **永遠先修改現有檔案**，不要創建新版本
2. 如果必須創建新檔案，使用描述性名稱而非版本號
3. 立即更新此文檔

### 版本管理
- 使用 Git 進行版本控制，不要在檔名中加入版本號
- 使用分支進行實驗性功能開發

## 🚀 部署指令

### Worker 部署
```bash
cd /mnt/c/claude/工程管理/workers
CLOUDFLARE_API_TOKEN="YOUR_TOKEN" npx wrangler deploy
```

### Pages 部署
```bash
cd /mnt/c/claude/工程管理
CLOUDFLARE_API_TOKEN="YOUR_TOKEN" npx wrangler pages deploy frontend --project-name construction-management-frontend
```

## ⚠️ 注意事項

1. **GitHub Actions 已停用** - 所有部署需手動執行
2. **api.yes-ceramics.com** 路由到 `construction-management-api-clerk`
3. **認證方式**: 手機號碼 + 後3碼密碼

## 🔄 每次變更後必做

1. 更新此文檔的「最後更新」日期
2. 在 Memory Keeper 中記錄變更
3. 確認沒有創建不必要的新檔案
4. 執行清理指令移除臨時檔案