# 部署自動化說明

## 🚀 GitHub Actions 工作流程

### 自動觸發部署

#### 開發環境
```bash
# API 自動部署
git push origin develop  # 當修改 workers/src/** 時

# 前端自動部署  
git push origin develop  # 當修改 frontend/** 時
```

#### 生產環境
```bash
# API 自動部署
git push origin main     # 當修改 workers/src/** 時

# 前端自動部署
git push origin main     # 當修改 frontend/** 時
```

### 手動觸發部署

1. **進入 GitHub Repository**
2. **點擊 "Actions" 標籤**
3. **選擇工作流程**：
   - `Deploy API to Development`
   - `Deploy API to Production`  
   - `Deploy Frontend to Development`
   - `Deploy Frontend to Production`
   - `Deploy Full Stack` (推薦)

4. **點擊 "Run workflow"**
5. **生產環境需要輸入確認**: 輸入 `DEPLOY`

## 🔐 必要設置

### GitHub Secrets

在 GitHub Repository Settings > Secrets and variables > Actions 中添加：

```
CLOUDFLARE_API_TOKEN = gF1zTU1MSg5JVfkuXOcVbR44MrC3Hx563iMTygW8
```

### 分支設置

```
main/master  → 生產環境
develop      → 開發環境
feature/*    → 功能開發（不自動部署）
hotfix/*     → 緊急修復（可手動部署到生產）
```

## 🌐 部署目標

### 開發環境
- **API**: https://construction-management-api-dev.lai-jameslai.workers.dev
- **前端**: https://construction-management-frontend-dev.pages.dev

### 生產環境  
- **API**: https://construction-management-api-prod.lai-jameslai.workers.dev
- **前端**: https://construction-management-frontend-prod.pages.dev

### 舊系統（保持運行）
- **舊前端**: https://cm-prod.pages.dev

## 📋 部署檢查清單

### 開發環境部署
- [ ] API 健康檢查通過
- [ ] 前端加載正常
- [ ] 配置檔正確指向開發 API

### 生產環境部署
- [ ] 確認輸入 "DEPLOY"
- [ ] API 健康檢查通過
- [ ] 登入功能測試通過
- [ ] 前端加載正常
- [ ] 配置檔正確指向生產 API
- [ ] 舊系統仍然運行

## 🔄 部署流程

### 自動部署流程
1. **推送代碼** → 觸發 GitHub Actions
2. **安裝依賴** → 確保環境一致
3. **部署 API** → 使用對應的 wrangler 配置
4. **健康檢查** → 驗證 API 可用性
5. **部署前端** → 更新配置並部署
6. **整合測試** → 驗證前後端連接

### 手動部署流程
1. **選擇工作流程** → 確認部署目標
2. **輸入確認** → 生產環境需要 "DEPLOY"
3. **執行部署** → 自動執行所有步驟
4. **驗證結果** → 檢查部署狀態

## ⚠️ 注意事項

### 生產環境部署
- 需要手動確認（輸入 "DEPLOY"）
- 會執行額外的測試步驟
- 建議在維護時間窗口執行

### 回滾策略
- 舊系統 `cm-prod.pages.dev` 保持運行
- 可以快速切換回舊 API
- Cloudflare Workers 支持版本管理

### 環境變數差異
```toml
# 開發環境 (wrangler.dev.toml)
ENVIRONMENT = "development"
ENABLE_EMERGENCY_LOGIN = "true"
JWT_SECRET = "your-jwt-secret-key-change-in-production"

# 生產環境 (wrangler.prod.toml)  
ENVIRONMENT = "production"
ENABLE_EMERGENCY_LOGIN = "false"
JWT_SECRET = "production-jwt-secret-key-2025"
```

## 🐛 故障排除

### 部署失敗
1. 檢查 GitHub Actions 日誌
2. 驗證 Cloudflare API Token 權限
3. 確認配置檔語法正確

### API 無法訪問
1. 檢查 Worker 部署狀態
2. 驗證環境變數設置
3. 檢查 D1 資料庫連接

### 前端配置錯誤
1. 確認使用 `config.unified.js`
2. 檢查環境檢測邏輯
3. 驗證 API URL 正確性

## 📞 支援聯繫

遇到問題時：
1. 檢查 GitHub Actions 執行記錄
2. 查看 Cloudflare Dashboard 部署狀態
3. 測試舊系統是否正常運行
4. 聯繫技術支援團隊