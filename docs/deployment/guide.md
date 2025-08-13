# 部署指南

## 🚀 部署總覽

本系統採用 Cloudflare 全棧解決方案，包含 Workers、D1、Pages 和 R2 服務。

## ⚡ 快速部署

### 先決條件
```bash
# 1. 安裝最新版 Wrangler CLI (重要!)
npm install -g wrangler@latest

# 2. 驗證版本 (必須 >= 4.0)
wrangler --version

# 3. 登入 Cloudflare
wrangler login
```

### 部署步驟

#### 1. 資料庫部署
```bash
# 進入 workers 目錄
cd workers

# 部署資料庫 schema 到遠端
wrangler d1 execute DB_ENGINEERING --remote --file=schema-final.sql

# 驗證資料庫
wrangler d1 info DB_ENGINEERING
```

#### 2. Worker 部署
```bash
# 部署 Worker API
wrangler deploy src/index.js --name construction-management-api-clerk --compatibility-date 2024-11-06

# 驗證部署
curl -s "https://construction-management-api-clerk.lai-jameslai.workers.dev/health"
```

#### 3. 前端部署
```bash
# 進入前端目錄
cd ../frontend

# 部署到 Cloudflare Pages
wrangler pages deploy . --project-name construction-management-frontend

# 或直接推送到 GitHub (自動部署)
git push origin master
```

#### 4. 建立示範資料
```bash
# 建立測試專案和資料
curl -s "https://api.yes-ceramics.com/create-demo"
```

## 🔧 環境配置

### Wrangler 配置檔案
`workers/wrangler.toml`:
```toml
name = "construction-api"
main = "src/index.js"
compatibility_date = "2024-11-06"
compatibility_flags = ["nodejs_compat"]

# 環境變數
[vars]
ENVIRONMENT = "production"
API_BASE_URL = "https://fx-d1-rest-api.lai-jameslai.workers.dev"
REST_API_TOKEN = "fx-crm-api-secret-2025"
JWT_SECRET = "your-jwt-secret-key"

# D1 資料庫綁定
[[d1_databases]]
binding = "DB_ENGINEERING"
database_name = "engineering-management"
database_id = "21fce5cd-8364-4dc2-be7f-6d68cbd6fca9"

[[d1_databases]]
binding = "DB_CRM"
database_name = "fx-crm-database"
database_id = "332221d8-61cb-4084-88dc-394e208ae8b4"

# KV 命名空間
[[kv_namespaces]]
binding = "SESSIONS"
id = "3d3356dca3684619bea5750829dbcaa5"

# R2 儲存桶
[[r2_buckets]]
binding = "CONSTRUCTION_PHOTOS"
bucket_name = "construction-photos"
```

### 自訂域名設定

#### DNS 配置
```bash
# 1. 在 Cloudflare Dashboard 新增 CNAME 記錄
# Name: api
# Content: construction-management-api-clerk.lai-jameslai.workers.dev
# Proxy: 橙雲 (已代理)

# 2. 建立 Worker Route (透過 API)
curl -X POST \
  "https://api.cloudflare.com/client/v4/zones/6fdcc0463928b49a083830626135dd0a/workers/routes" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pattern": "api.yes-ceramics.com/*",
    "script": "construction-management-api-clerk"
  }'
```

## 🔍 故障排除

### 常見問題

#### 1. Wrangler 部署沒有輸出
**問題**: 舊版本 Wrangler (< 4.0) 部署沒有詳細輸出
```bash
# 解決方案: 升級到最新版本
npm uninstall -g wrangler
npm install -g wrangler@latest
wrangler --version  # 確認 >= 4.0
```

#### 2. D1 SQL 語法錯誤
**問題**: `UNIQUE` 約束不支援函數表達式
```sql
-- 錯誤語法
UNIQUE(project_id, user_id, IFNULL(team_id, 'owner'))

-- 正確語法
UNIQUE(project_id, user_id, team_id)
```

#### 3. Worker 部署後沒有更新
**常見原因**:
- 使用錯誤的 Worker 名稱
- Route 指向舊的 Worker
- 快取問題

**解決方案**:
```bash
# 1. 確認正確的 Worker 名稱
wrangler list

# 2. 強制部署
wrangler deploy --force

# 3. 檢查 Route 配置
curl -H "Authorization: Bearer TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/ZONE_ID/workers/routes"
```

#### 4. CORS 跨域問題
**現象**: 前端無法連接 API
**檢查**:
```javascript
// 確認 Workers 程式碼包含 CORS 標頭
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};
```

## 📊 監控與日誌

### Worker 監控
```bash
# 即時日誌
wrangler tail construction-management-api-clerk

# 部署狀態
wrangler list

# 資源使用情況
wrangler d1 info DB_ENGINEERING
```

### 前端監控
```javascript
// 在瀏覽器 console 檢查
console.log('API Base URL:', CONFIG.API.WORKER_API_URL);

// 測試 API 連接
fetch('https://api.yes-ceramics.com/health')
  .then(r => r.json())
  .then(console.log);
```

## 🔄 持續部署

### GitHub Actions 設定
`.github/workflows/deploy.yml`:
```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [master]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: 'workers'
          command: deploy
```

### 環境變數
在 GitHub Settings → Secrets 新增:
- `CLOUDFLARE_API_TOKEN`: Cloudflare API Token
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare Account ID

## 📋 部署檢查清單

### 部署前檢查
- [ ] Wrangler CLI >= 4.0
- [ ] 資料庫 schema 已更新
- [ ] 環境變數已設定
- [ ] 自訂域名 DNS 已設定

### 部署後驗證
- [ ] API 健康檢查通過: `curl https://api.yes-ceramics.com/health`
- [ ] 示範資料建立成功: `curl https://api.yes-ceramics.com/create-demo`
- [ ] 前端可以連接 API
- [ ] 專案詳情頁面顯示正常

### 關鍵資源 ID
```bash
# Cloudflare 資源 ID (重要資訊)
Zone ID: 6fdcc0463928b49a083830626135dd0a
Route ID: 0cfbfafad8e245d3bdba145a6a54c788
Worker: construction-management-api-clerk
D1 Database: 21fce5cd-8364-4dc2-be7f-6d68cbd6fca9
```

## 🆘 緊急回復

### 快速回滾
```bash
# 1. 檢查部署歷史
wrangler deployments list construction-management-api-clerk

# 2. 回滾到上一版本
wrangler rollback construction-management-api-clerk --version-id PREVIOUS_VERSION_ID
```

### 資料庫回復
```bash
# 重新部署 schema (小心！會清空資料)
wrangler d1 execute DB_ENGINEERING --remote --file=schema-final.sql

# 重建示範資料
curl -s "https://api.yes-ceramics.com/create-demo"
```

---

**最後更新**: 2025-08-11  
**部署環境**: Cloudflare Workers + D1 + Pages  
**線上服務**: https://api.yes-ceramics.com