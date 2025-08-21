# Claude 工作記錄

## 部署策略

**重要**：所有部署都透過 GitHub Actions 進行，不再直接使用 wrangler 部署。

### 部署流程

1. **開發環境自動部署**：
   ```bash
   git push origin develop
   ```
   - 自動觸發 `Deploy API to Development`
   - 自動觸發 `Deploy Frontend to Development`

2. **生產環境部署**：
   ```bash
   git push origin main
   ```
   - 自動觸發生產環境部署
   - 或在 GitHub Actions 中手動觸發，需要輸入 "DEPLOY" 確認

3. **手動部署**：
   - 前往 GitHub Repository > Actions
   - 選擇對應的工作流程
   - 點擊 "Run workflow"
   - 生產環境需要輸入確認碼 "DEPLOY"

### 系統架構

#### 開發環境
- **API**: `https://construction-management-api-dev.lai-jameslai.workers.dev`
- **前端**: `https://construction-management-frontend-dev.pages.dev`

#### 生產環境
- **API**: `https://construction-management-api-prod.lai-jameslai.workers.dev`
- **前端**: `https://construction-management-frontend-prod.pages.dev`

#### 舊系統（保持運行）
- **舊前端**: `https://cm-prod.pages.dev`

### 配置檔案

- `workers/wrangler.dev.toml` - 開發環境 API 配置
- `workers/wrangler.prod.toml` - 生產環境 API 配置
- `frontend/config.js` - 前端統一配置（自動環境檢測）

### GitHub Secrets

已設置的必要 Secret：
- `CLOUDFLARE_API_TOKEN` - Cloudflare API 存取權杖

### 重要技術細節

1. **Node.js 版本要求**：GitHub Actions 使用 Node.js v20（Wrangler 最低需求）
2. **環境自動檢測**：前端會根據域名自動切換到對應的 API 端點
3. **版本控制**：develop 分支用於開發，main 分支用於生產
4. **健康檢查**：每次部署後會自動檢查 API 健康狀態

### 故障排除

如果 GitHub Actions 失敗：
1. 檢查 Node.js 版本（需要 v20+）
2. 確認 Cloudflare API Token 權限
3. 檢查配置檔語法
4. 查看 GitHub Actions 執行日誌

### CRM 同步功能

已實現的 CRM 同步功能文檔：
- `workers/docs/CRM-SYNC-IMPLEMENTATION.md`
- 包含成功的 FX CRM API 創建方法
- 本地 UUID + 延遲綁定架構

### 下次需要處理的項目

1. 修復案場更新同步功能
2. 同步所有工地師父 D1→CRM
3. 測試完整流程
4. 設置生產環境監控

## 最後更新

2025-08-21: 完成統一系統架構重整，所有部署改為 GitHub Actions 自動化。