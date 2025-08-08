# 部署指南 - 工程管理系統

## 📋 部署前準備

### 1. 必要帳戶
- [ ] Cloudflare 帳戶
- [ ] GitHub 帳戶（用於版本控制）
- [ ] 紛享銷客 API 憑證

### 2. 必要工具
```bash
# 安裝 Node.js (v18+)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安裝 Wrangler CLI
npm install -g wrangler

# 驗證安裝
node --version
wrangler --version
```

## 🚀 快速部署

### 方法一：自動化腳本部署

```bash
# 1. 克隆專案
git clone <repository-url>
cd fx-crm-sync

# 2. 執行初始設定
chmod +x scripts/setup.sh
./scripts/setup.sh

# 3. 設定環境變數
wrangler secret put FX_API_TOKEN
# 輸入: fx-crm-api-secret-2025

wrangler secret put JWT_SECRET
# 輸入: 您的JWT密鑰

# 4. 執行部署
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### 方法二：手動部署

#### Step 1: 設定 Cloudflare
```bash
# 登入 Cloudflare
wrangler login

# 創建 KV 命名空間
wrangler kv:namespace create "SESSION_STORE"
wrangler kv:namespace create "SYNC_STATE"

# 創建 R2 儲存桶
wrangler r2 bucket create construction-photos
```

#### Step 2: 設定資料庫
```bash
# D1 資料庫 ID（已存在）
# fx-crm-database: 332221d8-61cb-4084-88dc-394e208ae8b4
# engineering-management: 21fce5cd-8364-4dc2-be7f-6d68cbd6fca9

# 初始化資料庫結構
cd workers
wrangler d1 execute engineering-management --file=./schema-engineering.sql
```

#### Step 3: 更新配置
編輯 `workers/wrangler.toml`：
```toml
# 更新 KV namespace ID
[[kv_namespaces]]
binding = "SESSION_STORE"
id = "your-session-store-id"

[[kv_namespaces]]
binding = "SYNC_STATE"
id = "your-sync-state-id"

# 更新 R2 bucket
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "construction-photos"
```

#### Step 4: 部署 Workers
```bash
cd workers
npm install
wrangler deploy
```

## 🔧 GitHub Actions 自動部署

### 設定 GitHub Secrets
在 GitHub Repository Settings → Secrets 中新增：

1. `CLOUDFLARE_API_TOKEN`
   - 獲取方式：Cloudflare Dashboard → My Profile → API Tokens
   - 創建 Token 時選擇 "Edit Cloudflare Workers" 模板

2. `FX_API_TOKEN`
   - 值：fx-crm-api-secret-2025

3. `JWT_SECRET`
   - 生成隨機字串：`openssl rand -base64 32`

### 啟用 GitHub Actions
```yaml
# .github/workflows/deploy.yml 已配置
# 推送到 main/master 分支時自動部署
```

## 🌐 前端部署

### 選項 1: GitHub Pages
```bash
# 在 GitHub Repository Settings → Pages
# Source: Deploy from a branch
# Branch: main / docs
```

### 選項 2: Cloudflare Pages
```bash
# 1. 在 Cloudflare Dashboard 創建 Pages 專案
# 2. 連接 GitHub Repository
# 3. 設定：
#    - Build command: 留空
#    - Build output directory: frontend
#    - Root directory: /
```

### 選項 3: 靜態網站託管
將 `frontend/` 目錄上傳到：
- Netlify
- Vercel
- AWS S3 + CloudFront
- 任何支援靜態檔案的伺服器

## 📝 環境變數配置

### Workers 環境變數
```bash
# 必要
wrangler secret put FX_API_TOKEN
wrangler secret put JWT_SECRET

# 可選
wrangler secret put CORS_ORIGIN  # 前端網域
wrangler secret put API_RATE_LIMIT  # API 速率限制
```

### 前端配置
編輯前端 HTML 檔案中的 API URL：
```javascript
// 將所有 API URL 改為您的 Worker URL
const WORKER_API_URL = 'https://construction-management-api.workers.dev';
```

## 🔍 驗證部署

### 1. 檢查 Worker 狀態
```bash
# 查看日誌
wrangler tail

# 測試 API
curl https://construction-management-api.workers.dev/health
```

### 2. 測試功能
```bash
# 測試登入
curl -X POST https://construction-management-api.workers.dev/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "0912345678", "password": "678"}'
```

### 3. 監控
- Cloudflare Dashboard → Workers → Analytics
- 查看請求數、錯誤率、延遲等指標

## 🚨 故障排除

### 常見問題

#### 1. D1 資料庫連接失敗
```bash
# 檢查 database_id
wrangler d1 list

# 更新 wrangler.toml 中的 database_id
```

#### 2. KV 命名空間錯誤
```bash
# 獲取 namespace ID
wrangler kv:namespace list

# 更新 wrangler.toml
```

#### 3. R2 上傳失敗
```bash
# 檢查 bucket 是否存在
wrangler r2 bucket list

# 檢查 CORS 設定
```

#### 4. 認證失敗
```bash
# 檢查 JWT_SECRET 是否設定
wrangler secret list

# 重新設定
wrangler secret put JWT_SECRET
```

## 📊 性能優化

### 1. 啟用快取
```javascript
// 在 Worker 中使用 Cache API
const cache = caches.default;
```

### 2. 使用 Cloudflare CDN
- 將靜態資源放在 R2
- 啟用 Cloudflare 快取規則

### 3. 資料庫優化
```sql
-- 創建索引
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_sites_opportunity ON object_8w9cb__c(field_1P96q__c);
```

## 🔐 安全設定

### 1. 啟用 WAF
在 Cloudflare Dashboard → Security → WAF

### 2. 設定速率限制
```toml
# wrangler.toml
[env.production]
vars = { RATE_LIMIT = "100" }
```

### 3. IP 白名單（可選）
```javascript
// 在 Worker 中實作
const allowedIPs = ['1.2.3.4', '5.6.7.8'];
```

## 📞 支援資源

- [Cloudflare Workers 文檔](https://developers.cloudflare.com/workers/)
- [Wrangler CLI 文檔](https://developers.cloudflare.com/workers/wrangler/)
- [D1 資料庫文檔](https://developers.cloudflare.com/d1/)
- [R2 儲存文檔](https://developers.cloudflare.com/r2/)

## ✅ 部署檢查清單

- [ ] Cloudflare 帳戶已設定
- [ ] Wrangler CLI 已安裝並登入
- [ ] D1 資料庫已創建並初始化
- [ ] KV 命名空間已創建
- [ ] R2 儲存桶已創建
- [ ] 環境變數已設定
- [ ] Worker 已成功部署
- [ ] 前端已部署並可訪問
- [ ] API 端點測試通過
- [ ] 登入功能正常
- [ ] 檔案上傳功能正常
- [ ] 監控和日誌已設定