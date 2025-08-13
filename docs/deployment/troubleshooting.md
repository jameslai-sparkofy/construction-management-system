# 故障排除指南

## 🚨 常見問題快速診斷

### 問題分類檢查清單

#### ✅ 部署相關問題
- [ ] Wrangler CLI 版本 >= 4.0
- [ ] Cloudflare API Token 有效
- [ ] wrangler.toml 設定正確
- [ ] 資料庫綁定設定正確

#### ✅ API 相關問題
- [ ] Worker 部署成功
- [ ] 自訂域名 DNS 設定正確
- [ ] CORS 標頭設定正確
- [ ] 資料庫 schema 同步

#### ✅ 前端相關問題  
- [ ] config.js API URL 正確
- [ ] 瀏覽器 CORS 政策
- [ ] 網路連線正常
- [ ] JavaScript 語法錯誤

## 🔧 部署問題排除

### 1. Wrangler 部署沒有輸出

**症狀**:
```bash
$ wrangler deploy
# 沒有任何輸出，但也沒有錯誤
```

**診斷**:
```bash
# 檢查 Wrangler 版本
wrangler --version

# 如果版本 < 4.0，立即升級
npm uninstall -g wrangler
npm install -g wrangler@latest
```

**解決方案**:
```bash
# 1. 升級 Wrangler CLI
npm install -g wrangler@latest

# 2. 重新部署（應該會有詳細輸出）
wrangler deploy src/index.js --name construction-management-api-clerk --compatibility-date 2024-11-06

# 3. 驗證部署
curl -s "https://construction-management-api-clerk.lai-jameslai.workers.dev/health"
```

**預期輸出**:
```bash
⛅️ wrangler 4.28.1
───────────────────
Total Upload: 39.31 KiB / gzip: 8.58 KiB
Worker Startup Time: 12 ms
Your Worker has access to the following bindings:
...
Uploaded construction-management-api-clerk (4.58 sec)
```

### 2. D1 資料庫語法錯誤

**症狀**:
```bash
✘ [ERROR] expressions prohibited in PRIMARY KEY and UNIQUE constraints: SQLITE_ERROR
```

**常見錯誤語法**:
```sql
-- ❌ 錯誤：UNIQUE 約束中使用函數
UNIQUE(project_id, user_id, IFNULL(team_id, 'owner'))

-- ❌ 錯誤：PRIMARY KEY 中使用表達式  
PRIMARY KEY(CONCAT(project_id, '_', user_id))
```

**正確語法**:
```sql
-- ✅ 正確：簡單欄位約束
UNIQUE(project_id, user_id, team_id)

-- ✅ 正確：複合主鍵
PRIMARY KEY(project_id, user_id)
```

**解決步驟**:
```bash
# 1. 修復 schema-final.sql 中的語法錯誤
# 2. 重新部署到本地測試
wrangler d1 execute DB_ENGINEERING --file=schema-final.sql

# 3. 確認無錯誤後部署到遠端
wrangler d1 execute DB_ENGINEERING --remote --file=schema-final.sql
```

### 3. Worker 部署後仍返回舊版本

**症狀**:
- API 回應格式或內容是舊版本
- 新端點返回 404 錯誤
- 功能沒有更新

**診斷步驟**:
```bash
# 1. 檢查 Worker 列表
wrangler list

# 2. 檢查 Worker 最後修改時間
curl -s -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/ACCOUNT_ID/workers/scripts" \
  | jq '.result[] | select(.id=="construction-management-api-clerk") | .modified_on'

# 3. 檢查部署版本
wrangler deployments list construction-management-api-clerk
```

**可能原因與解決方案**:

#### 3.1 部署到錯誤的 Worker 名稱
```bash
# 確認正確的 Worker 名稱
wrangler list | grep construction

# 使用正確名稱重新部署
wrangler deploy src/index.js --name construction-management-api-clerk
```

#### 3.2 Route 指向錯誤的 Worker
```bash
# 檢查 Route 配置
curl -s -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/6fdcc0463928b49a083830626135dd0a/workers/routes"

# 更新 Route 指向正確的 Worker
curl -X PUT -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pattern": "api.yes-ceramics.com/*", "script": "construction-management-api-clerk"}' \
  "https://api.cloudflare.com/client/v4/zones/6fdcc0463928b49a083830626135dd0a/workers/routes/0cfbfafad8e245d3bdba145a6a54c788"
```

#### 3.3 快取問題
```bash
# 1. 強制部署
wrangler deploy --force

# 2. 清除 Cloudflare 快取 (透過 Dashboard)
# 3. 使用不同的測試 URL
curl -s "https://construction-management-api-clerk.lai-jameslai.workers.dev/health?v=$(date +%s)"
```

## 🌐 API 連接問題排除

### 1. CORS 跨域錯誤

**瀏覽器錯誤訊息**:
```
Access to fetch at 'https://api.yes-ceramics.com/health' from origin 'https://example.com' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

**檢查 Worker CORS 設定**:
```javascript
// 確認 Worker 程式碼包含正確的 CORS 標頭
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// OPTIONS 請求處理
if (method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}
```

**測試 CORS**:
```bash
# 檢查 CORS 標頭
curl -I -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET" \
  "https://api.yes-ceramics.com/health"
```

### 2. API 連接超時

**症狀**: 請求超過 30 秒沒有回應

**診斷**:
```bash
# 1. 測試基本連線
ping api.yes-ceramics.com

# 2. 測試 HTTP 連線
curl -w "@curl-format.txt" -s "https://api.yes-ceramics.com/health"

# curl-format.txt 內容:
#     time_namelookup:  %{time_namelookup}\n
#        time_connect:  %{time_connect}\n
#     time_appconnect:  %{time_appconnect}\n
#    time_pretransfer:  %{time_pretransfer}\n
#       time_redirect:  %{time_redirect}\n
#  time_starttransfer:  %{time_starttransfer}\n
#                     ----------\n
#          time_total:  %{time_total}\n
```

**可能原因**:
1. **DNS 問題**: 檢查域名解析
2. **Worker 冷啟動**: 首次請求可能較慢
3. **資料庫查詢超時**: 檢查 D1 查詢效能

### 3. 404 Not Found 錯誤

**診斷步驟**:
```javascript
// 1. 檢查前端 API URL 配置
console.log('API Base URL:', CONFIG.API.WORKER_API_URL);

// 2. 檢查完整請求 URL
const testUrl = API.getUrl('/health');
console.log('Full URL:', testUrl);

// 3. 直接測試 Worker
fetch('https://api.yes-ceramics.com/health')
  .then(r => r.text())
  .then(console.log);
```

**常見錯誤**:
```javascript
// ❌ 錯誤：多餘的斜線
const url = `${baseUrl}/${endpoint}`; // 可能變成 example.com//api/health

// ✅ 正確：處理斜線
const url = `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
```

## 💾 資料庫問題排除

### 1. D1 連接錯誤

**症狀**:
```javascript
// 錯誤訊息
D1_ERROR: Database not found: DB_ENGINEERING
```

**檢查綁定設定**:
```toml
# wrangler.toml
[[d1_databases]]
binding = "DB_ENGINEERING"
database_name = "engineering-management"
database_id = "21fce5cd-8364-4dc2-be7f-6d68cbd6fca9"
```

**驗證資料庫**:
```bash
# 1. 列出所有 D1 資料庫
wrangler d1 list

# 2. 查看特定資料庫資訊
wrangler d1 info DB_ENGINEERING

# 3. 測試查詢
wrangler d1 execute DB_ENGINEERING --command "SELECT COUNT(*) FROM projects"
```

### 2. 資料查詢錯誤

**症狀**:
```
SQLITE_ERROR: table projects has no column named spc_engineering
```

**解決步驟**:
```bash
# 1. 檢查本地和遠端 schema 差異
wrangler d1 execute DB_ENGINEERING --command ".schema projects"
wrangler d1 execute DB_ENGINEERING --remote --command ".schema projects"

# 2. 重新部署 schema
wrangler d1 execute DB_ENGINEERING --remote --file=schema-final.sql

# 3. 驗證表格結構
wrangler d1 execute DB_ENGINEERING --remote --command "PRAGMA table_info(projects)"
```

## 🖥️ 前端問題排除

### 1. JavaScript 錯誤

**檢查控制台錯誤**:
```javascript
// 1. 開啟瀏覽器開發者工具 (F12)
// 2. 查看 Console 標籤
// 3. 重新載入頁面，觀察錯誤訊息

// 常見錯誤類型：
// - ReferenceError: CONFIG is not defined
// - TypeError: Cannot read property 'API' of undefined
// - SyntaxError: Unexpected token '<'
```

**除錯技巧**:
```javascript
// 1. 檢查關鍵物件是否載入
console.log('CONFIG:', typeof CONFIG !== 'undefined' ? CONFIG : 'undefined');
console.log('API:', typeof API !== 'undefined' ? API : 'undefined');

// 2. 測試 API 連線
if (typeof API !== 'undefined') {
    API.get('/health')
        .then(data => console.log('Health check:', data))
        .catch(err => console.error('Health check failed:', err));
}

// 3. 檢查網路請求
// 開發者工具 → Network 標籤 → 重新載入頁面
```

### 2. 頁面載入問題

**症狀**: 頁面空白或載入不完整

**檢查步驟**:
```bash
# 1. 檢查檔案路徑
ls -la frontend/
ls -la frontend/js/
ls -la frontend/css/

# 2. 驗證檔案語法
node -c frontend/js/api-client.js
node -c frontend/config.js
```

**HTML 檔案檢查**:
```html
<!-- 確認所有資源路徑正確 -->
<link rel="stylesheet" href="css/global.css">
<script src="config.js"></script>
<script src="js/api-client.js"></script>

<!-- 檢查 script 載入順序 -->
<!-- config.js 必須在 api-client.js 之前載入 -->
```

## 📊 監控與診斷工具

### 1. Worker 日誌監控
```bash
# 即時查看 Worker 日誌
wrangler tail construction-management-api-clerk

# 過濾特定類型日誌
wrangler tail construction-management-api-clerk --format pretty --grep "ERROR"
```

### 2. 資料庫監控
```bash
# 查看資料庫大小和統計
wrangler d1 info DB_ENGINEERING

# 查看最近的查詢效能
wrangler d1 execute DB_ENGINEERING --remote --command "
  SELECT sql, count FROM sqlite_master 
  WHERE type='table' AND name LIKE 'sqlite_stat%'
"
```

### 3. 網路診斷
```bash
# DNS 解析測試
nslookup api.yes-ceramics.com
dig api.yes-ceramics.com

# 路由追蹤
traceroute api.yes-ceramics.com

# HTTP 回應測試
curl -v "https://api.yes-ceramics.com/health"
```

## 🆘 緊急回復流程

### 1. 快速回滾
```bash
# 1. 檢查部署歷史
wrangler deployments list construction-management-api-clerk

# 2. 回滾到穩定版本
wrangler rollback construction-management-api-clerk --version-id STABLE_VERSION_ID

# 3. 驗證回滾成功
curl -s "https://api.yes-ceramics.com/health"
```

### 2. 緊急維護模式
```javascript
// 在 Worker 中添加維護模式檢查
export default {
  async fetch(request, env, ctx) {
    // 緊急維護模式
    if (env.MAINTENANCE_MODE === 'true') {
      return new Response(JSON.stringify({
        status: 'maintenance',
        message: '系統維護中，請稍後再試'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 正常處理邏輯...
  }
}
```

### 3. 聯絡支援
當無法自行解決問題時：

1. **收集診斷資訊**:
   - Wrangler 版本
   - 錯誤訊息完整內容  
   - 重現步驟
   - Worker 日誌

2. **建立 GitHub Issue**:
   - 使用問題模板
   - 附上診斷資訊
   - 標記緊急程度

3. **臨時解決方案**:
   - 切換到備用 API 端點
   - 啟用前端快取模式
   - 顯示維護通知

---

**最後更新**: 2025-08-11  
**緊急聯絡**: GitHub Issues  
**支援時間**: 週一至週五 9:00-18:00