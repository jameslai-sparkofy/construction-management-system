# 工程管理系統 - Cloudflare Workers 部署指南

## 目錄
1. [前置需求](#前置需求)
2. [環境設置](#環境設置)
3. [創建 Cloudflare 資源](#創建-cloudflare-資源)
4. [配置環境變數](#配置環境變數)
5. [本地開發](#本地開發)
6. [部署到生產環境](#部署到生產環境)
7. [驗證部署](#驗證部署)
8. [故障排除](#故障排除)

## 前置需求

- Node.js 18 或更高版本
- npm 或 yarn
- Cloudflare 帳號
- Wrangler CLI (會自動安裝)

## 環境設置

### 1. 安裝依賴

```bash
cd /mnt/c/claude\ code/工程管理/workers
npm install
```

### 2. 登入 Cloudflare

```bash
npx wrangler login
```

這會打開瀏覽器讓您登入 Cloudflare 帳號。

## 創建 Cloudflare 資源

### 1. 創建 KV Namespaces

執行以下命令創建必要的 KV namespaces：

```bash
# 創建 Sessions KV (用於儲存用戶 session)
npx wrangler kv:namespace create "SESSIONS"
# 輸出範例: Created namespace with ID: abc123...

# 創建 Users KV (用於快取用戶資料)
npx wrangler kv:namespace create "USERS"
# 輸出範例: Created namespace with ID: def456...

# 創建 Files KV (用於檔案元數據)
npx wrangler kv:namespace create "FILES_KV"
# 輸出範例: Created namespace with ID: ghi789...
```

### 2. 創建 R2 Bucket

```bash
# 創建 R2 bucket 用於儲存施工照片
npx wrangler r2 bucket create construction-photos
```

### 3. 記錄 ID

將上述命令輸出的 ID 記錄下來，稍後需要更新到 `wrangler.toml`。

## 配置環境變數

### 1. 更新 wrangler.toml

編輯 `wrangler.toml` 檔案，將剛才創建的資源 ID 填入：

```toml
name = "construction-management-api"
main = "src/index.js"
compatibility_date = "2024-11-06"
compatibility_flags = ["nodejs_compat"]

# 環境變數
[vars]
ENVIRONMENT = "development"
API_BASE_URL = "https://fx-d1-rest-api.lai-jameslai.workers.dev"
CRUD_API_URL = "https://fx-crm-sync.lai-jameslai.workers.dev/api"
REST_API_TOKEN = "fx-crm-api-secret-2025"
JWT_SECRET = "your-secure-jwt-secret-change-this-in-production"
FRONTEND_BASE_URL = "https://manage.yes-ceramics.com"

# KV Namespaces - 更新這些 ID
[[kv_namespaces]]
binding = "SESSIONS"
id = "abc123..."  # 替換為實際的 Sessions KV ID

[[kv_namespaces]]
binding = "USERS"
id = "def456..."  # 替換為實際的 Users KV ID

[[kv_namespaces]]
binding = "FILES_KV"
id = "ghi789..."  # 替換為實際的 Files KV ID

# R2 Bucket
[[r2_buckets]]
binding = "CONSTRUCTION_PHOTOS"
bucket_name = "construction-photos"
```

### 2. 生成安全的 JWT Secret

在生產環境中，請使用安全的隨機字串作為 JWT_SECRET：

```bash
# 生成隨機密鑰
openssl rand -base64 32
```

## 本地開發

### 1. 啟動開發服務器

```bash
npm run dev
```

服務將在 `http://localhost:8787` 啟動。

### 2. 測試 API

使用 curl 或 Postman 測試 API：

```bash
# 健康檢查
curl http://localhost:8787/health

# 登入測試
curl -X POST http://localhost:8787/api/v1/tenant/yes-ceramics/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0912345678",
    "password": "678"
  }'
```

## 部署到生產環境

### 1. 部署到 Cloudflare

```bash
npm run deploy
```

### 2. 設置自定義域名（可選）

在 Cloudflare Dashboard 中：
1. 進入 Workers & Pages
2. 選擇您的 Worker
3. 在 "Triggers" 標籤中添加自定義域名

## 驗證部署

### 1. 檢查部署狀態

```bash
npx wrangler tail
```

這會顯示即時的日誌輸出。

### 2. 測試生產環境 API

```bash
# 替換為您的 Worker URL
WORKER_URL="https://construction-management-api.your-subdomain.workers.dev"

# 健康檢查
curl $WORKER_URL/health

# 測試登入
curl -X POST $WORKER_URL/api/v1/tenant/yes-ceramics/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0912345678",
    "password": "678"
  }'
```

### 3. 前端配置

更新前端的 API 端點設定：

```javascript
// frontend/js/api-client.js
const apiClient = new ApiClient(
    window.location.hostname === 'localhost' 
        ? 'http://localhost:8787' 
        : 'https://construction-management-api.your-subdomain.workers.dev',
    'yes-ceramics'
);
```

## 故障排除

### 常見問題

#### 1. KV namespace 錯誤
```
Error: No KV namespace bound to SESSIONS
```
**解決方案**：確認 wrangler.toml 中的 KV namespace ID 正確。

#### 2. R2 bucket 錯誤
```
Error: No R2 bucket bound to CONSTRUCTION_PHOTOS
```
**解決方案**：確認 R2 bucket 已創建且名稱正確。

#### 3. CORS 錯誤
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```
**解決方案**：在 `src/index.js` 中更新 CORS 允許的來源。

#### 4. 認證失敗
```
Error: Invalid credentials
```
**解決方案**：
- 確認手機號碼格式正確（10 位數字）
- 密碼為手機號碼後 3 碼
- 檢查 D1 API 連接是否正常

### 調試命令

```bash
# 查看即時日誌
npx wrangler tail

# 查看 KV 內容
npx wrangler kv:key list --namespace-id=YOUR_NAMESPACE_ID

# 測試特定環境
npx wrangler dev --env production
```

## 監控和維護

### 1. 查看分析數據

在 Cloudflare Dashboard 中查看：
- 請求數量
- 錯誤率
- 執行時間
- KV 和 R2 使用量

### 2. 更新部署

```bash
# 更新代碼後重新部署
npm run deploy

# 回滾到之前的版本
npx wrangler rollback
```

### 3. 備份重要數據

定期備份：
- KV namespace 數據
- R2 bucket 內容
- 配置文件

## 安全建議

1. **定期更新密鑰**：每 3-6 個月更換 JWT_SECRET
2. **監控異常活動**：設置告警規則
3. **限制 API 訪問**：使用 Cloudflare WAF 規則
4. **加密敏感數據**：在 KV 中儲存加密的用戶資料

## 支援資源

- [Cloudflare Workers 文檔](https://developers.cloudflare.com/workers/)
- [Wrangler CLI 文檔](https://developers.cloudflare.com/workers/wrangler/)
- [專案 README](./README.md)

---

最後更新：2024-11-06