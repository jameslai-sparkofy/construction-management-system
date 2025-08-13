# GitHub Actions 設置指南

## 需要手動設置的步驟

### 1. 設置 GitHub Secrets

在 GitHub Repository 頁面：
1. 進入 **Settings** > **Secrets and variables** > **Actions**
2. 點擊 **New repository secret**
3. 添加以下 Secrets：

#### 生產環境 Token
- **Name**: `CLOUDFLARE_API_TOKEN_PRODUCTION`
- **Value**: 您的生產環境 Cloudflare API Token

#### 開發環境 Token
- **Name**: `CLOUDFLARE_API_TOKEN_DEVELOPMENT`  
- **Value**: 您的開發環境 Cloudflare API Token

### 2. 設置分支保護規則

#### Production 分支保護
1. 進入 **Settings** > **Branches**
2. 點擊 **Add rule**
3. **Branch name pattern**: `production`
4. 勾選以下選項：
   - ✅ Require a pull request before merging
   - ✅ Require approvals (至少 1 個)
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - ✅ Include administrators
5. 點擊 **Create**

#### Development 分支設置
- 不需要特別保護，允許直接推送

### 3. 創建 GitHub Actions 工作流程

由於權限限制，請手動創建以下文件：

#### `.github/workflows/deploy-production.yml`
```yaml
name: Deploy Production

on:
  push:
    branches:
      - production

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd workers
          npm ci
      
      - name: Deploy API to Cloudflare Workers
        run: |
          cd workers
          npx wrangler deploy --config wrangler-production.toml
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN_PRODUCTION }}
      
      - name: Deploy Frontend to Cloudflare Pages
        run: |
          cd workers
          npx wrangler pages deploy ../frontend \
            --project-name construction-management-frontend-prod \
            --branch production \
            --commit-dirty=true
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN_PRODUCTION }}
```

#### `.github/workflows/deploy-development.yml`
```yaml
name: Deploy Development

on:
  push:
    branches:
      - development
  pull_request:
    branches:
      - production

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: development
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd workers
          npm ci
      
      - name: Deploy API to Cloudflare Workers
        run: |
          cd workers
          npx wrangler deploy --config wrangler-develop.toml
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN_DEVELOPMENT }}
      
      - name: Deploy Frontend to Cloudflare Pages
        run: |
          cd workers
          npx wrangler pages deploy ../frontend \
            --project-name construction-management-frontend-dev \
            --branch development \
            --commit-dirty=true
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN_DEVELOPMENT }}
```

### 4. 環境設置

在 GitHub Repository：
1. 進入 **Settings** > **Environments**
2. 創建兩個環境：
   - **production**: 用於生產部署
   - **development**: 用於開發部署

### 5. Cloudflare API Token 權限

確保您的 API Token 具有以下權限：
- Account: Cloudflare Pages:Edit
- Account: Cloudflare Workers Scripts:Edit
- Account: Account Settings:Read
- Zone: Workers Routes:Edit

### 6. 測試部署

#### 測試開發環境部署
```bash
git checkout development
git push origin development
```

#### 測試生產環境部署
1. 創建 Pull Request 從 development 到 production
2. 審核並合併
3. 自動觸發生產部署

## 當前分支結構

```
master (主分支)
├── production (生產分支) - 自動部署到生產環境
└── development (開發分支) - 自動部署到開發環境
```

## 部署 URL

### 生產環境
- Frontend: https://construction-management-frontend-prod.pages.dev
- API: https://construction-api-production.lai-jameslai.workers.dev

### 開發環境
- Frontend: https://construction-management-frontend-dev.pages.dev
- API: https://construction-api-development.lai-jameslai.workers.dev

## 注意事項

1. **不要直接推送到 production 分支**
   - 所有更改必須通過 Pull Request

2. **開發新功能**
   - 在 development 分支或功能分支上開發
   - 測試後再合併到 production

3. **緊急修復**
   - 從 production 創建 hotfix 分支
   - 修復後創建 PR 回 production
   - 記得同步回 development