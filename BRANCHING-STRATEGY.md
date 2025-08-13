# 分支策略與部署流程

## 分支結構

### 1. **production** (生產分支)
- 用途：穩定的生產環境代碼
- 部署到：https://construction-management-frontend-prod.pages.dev
- API：https://construction-api-production.lai-jameslai.workers.dev
- 保護規則：
  - 需要 Pull Request 才能合併
  - 需要至少 1 個審核
  - 自動部署到生產環境

### 2. **development** (開發分支)
- 用途：開發和測試新功能
- 部署到：https://construction-management-frontend-dev.pages.dev
- API：https://construction-api-development.lai-jameslai.workers.dev
- 特點：
  - 可直接推送更改
  - 自動部署到開發環境
  - 新功能先在此分支測試

### 3. **master** (主分支)
- 用途：代碼庫的主線
- 特點：
  - 保留作為歷史記錄
  - 不直接部署

## 工作流程

### 開發新功能
```bash
# 1. 從 development 創建功能分支
git checkout development
git pull origin development
git checkout -b feature/新功能名稱

# 2. 開發並提交
git add .
git commit -m "Add: 新功能描述"

# 3. 推送到 GitHub
git push origin feature/新功能名稱

# 4. 創建 Pull Request 合併到 development
```

### 部署到生產環境
```bash
# 1. 確保 development 分支穩定
git checkout development
git pull origin development

# 2. 創建 Pull Request 從 development 到 production
# 在 GitHub 上操作

# 3. 審核並合併後自動部署
```

## 環境配置

### 生產環境 (Production)
- **Frontend Config**: `frontend/config.production.js`
- **API Config**: `workers/wrangler-production.toml`
- **API Token**: 使用生產環境專用 Token

### 開發環境 (Development)
- **Frontend Config**: `frontend/config.develop.js`
- **API Config**: `workers/wrangler-develop.toml`
- **API Token**: 使用開發環境專用 Token

## GitHub Actions 自動部署

### Production 部署
- 觸發條件：推送到 `production` 分支
- 工作流程：`.github/workflows/deploy-production.yml`
- 部署目標：生產環境

### Development 部署
- 觸發條件：
  - 推送到 `development` 分支
  - 創建 PR 到 `production` 分支
- 工作流程：`.github/workflows/deploy-development.yml`
- 部署目標：開發環境

## 緊急修復流程

```bash
# 1. 從 production 創建 hotfix 分支
git checkout production
git pull origin production
git checkout -b hotfix/修復描述

# 2. 修復並測試
git add .
git commit -m "Hotfix: 修復描述"

# 3. 推送並創建 PR 到 production
git push origin hotfix/修復描述

# 4. 審核後合併，自動部署

# 5. 同步回 development
git checkout development
git merge production
git push origin development
```

## 環境變數設置

### GitHub Secrets 配置
需要在 GitHub Repository Settings > Secrets 中設置：

1. **CLOUDFLARE_API_TOKEN_PRODUCTION**
   - 用於生產環境部署
   - 權限：Workers 和 Pages 部署

2. **CLOUDFLARE_API_TOKEN_DEVELOPMENT**
   - 用於開發環境部署
   - 權限：Workers 和 Pages 部署

## 部署檢查清單

### 部署前檢查
- [ ] 代碼已通過本地測試
- [ ] 已更新相關文檔
- [ ] 已檢查環境配置文件
- [ ] 已確認 API 端點正確

### 部署後驗證
- [ ] 網站可正常訪問
- [ ] 登入功能正常
- [ ] API 連接正常
- [ ] 數據讀寫正常
- [ ] 無控制台錯誤

## 版本標籤

### 創建版本標籤
```bash
# 在 production 分支上創建版本標籤
git checkout production
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

### 版本命名規則
- **主版本** (v1.0.0): 重大更新或不兼容的變更
- **次版本** (v0.1.0): 新功能添加
- **修訂版** (v0.0.1): Bug 修復和小改進