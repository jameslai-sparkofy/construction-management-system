# Claude 工作記錄

## 部署策略

**重要**：所有部署都透過 GitHub Actions 進行，不再直接使用 wrangler 部署。

**⚠️ 安全提醒**：永遠不要推送到生產環境（main 分支），除非用戶明確指示。只推送到開發環境（develop 分支）。

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
5. **Commit Message 編碼問題**：Cloudflare Pages 部署不支援中文 commit message，會出現「Invalid commit message, it must be a valid UTF-8 string」錯誤。解決方案：使用英文 commit message 或用 `git commit --amend` 修改後強制推送

### CRM 同步功能

已實現的 CRM 同步功能文檔：
- `workers/docs/CRM-SYNC-IMPLEMENTATION.md`
- 包含成功的 FX CRM API 創建方法
- 本地 UUID + 延遲綁定架構

### Playwright 快速開發流程

**重要經驗**：對於小幅 CSS/HTML 修改，可採用快速驗證流程：

1. **快速診斷**：用 Playwright 打開線上頁面，用 `browser_evaluate` 直接修改 CSS/HTML
2. **即時驗證**：在瀏覽器中立即看到修改效果，確認解決方案可行
3. **確認後實施**：驗證成功後再修改源碼並推送

**適用場景**：
- CSS 樣式調整
- 布局問題修復
- 透明度/間距問題
- Sticky 定位問題

**實際案例**：表格容器空隙問題
- 問題：`floor-grid-container` 和 `gridContent` 間有 8px 空隙
- 診斷：用 Playwright 檢查發現是 container padding 造成
- 快速測試：`container.style.padding = '0'` 立即驗證效果
- 確認修復：空隙消除，sticky headers 正常工作
- 實施：修改源碼 `padding: 1.5rem` → `padding: 0`

### 下次需要處理的項目

1. 修復案場更新同步功能
2. 同步所有工地師父 D1→CRM
3. 測試完整流程
4. 設置生產環境監控

## 最後更新

2025-08-23: 建立 Playwright 快速開發流程，用於小幅 UI 修改的快速驗證。
2025-08-21: 完成統一系統架構重整，所有部署改為 GitHub Actions 自動化。