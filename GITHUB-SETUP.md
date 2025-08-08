# GitHub 設定指南

## 建立 GitHub Repository

### Step 1: 在 GitHub 建立新 Repository

1. 登入 [GitHub](https://github.com)
2. 點擊右上角 "+" → "New repository"
3. 設定 Repository：
   - Repository name: `construction-management-system`
   - Description: 工程管理系統 - Cloudflare Workers 建築施工管理平台
   - Public 或 Private（根據需求）
   - **不要** 初始化 README、.gitignore 或 LICENSE

### Step 2: 連接本地 Repository

在本地執行以下指令：

```bash
# 進入專案目錄
cd "/mnt/c/claude code/工程管理"

# 添加遠端 repository（替換 YOUR_USERNAME）
git remote add origin https://github.com/YOUR_USERNAME/construction-management-system.git

# 或使用 SSH（如果已設定 SSH key）
git remote add origin git@github.com:YOUR_USERNAME/construction-management-system.git

# 驗證遠端設定
git remote -v

# 推送到 GitHub
git push -u origin master
```

### Step 3: 設定 GitHub Secrets

在 GitHub Repository 頁面：

1. 進入 Settings → Secrets and variables → Actions
2. 點擊 "New repository secret"
3. 添加以下 Secrets：

#### CLOUDFLARE_API_TOKEN
- 前往 [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
- 點擊 "Create Token"
- 使用 "Edit Cloudflare Workers" 模板
- 設定權限：
  - Account: Cloudflare Workers Scripts:Edit
  - Zone: Zone:Read, Cache Purge:Purge
- 複製 Token 並儲存到 GitHub Secrets

#### FX_API_TOKEN
- Value: `fx-crm-api-secret-2025`

#### JWT_SECRET
- 生成隨機字串：
  ```bash
  openssl rand -base64 32
  ```
- 或使用線上生成器

### Step 4: 啟用 GitHub Actions

1. 確認 `.github/workflows/deploy.yml` 已存在
2. 推送代碼後，Actions 會自動執行
3. 查看 Actions 頁面確認部署狀態

### Step 5: 設定 GitHub Pages（可選）

如果要使用 GitHub Pages 託管前端：

1. Settings → Pages
2. Source: Deploy from a branch
3. Branch: master (或 main)
4. Folder: /frontend
5. Save

等待幾分鐘後，前端會部署到：
`https://YOUR_USERNAME.github.io/construction-management-system/`

## 協作設定

### 添加協作者

1. Settings → Manage access
2. Invite a collaborator
3. 輸入協作者的 GitHub 用戶名或 email

### 分支保護（建議）

1. Settings → Branches
2. Add rule
3. Branch name pattern: `master` 或 `main`
4. 啟用保護選項：
   - Require pull request reviews before merging
   - Require status checks to pass before merging
   - Include administrators

## 常用 Git 指令

```bash
# 查看狀態
git status

# 添加所有變更
git add .

# 提交變更
git commit -m "feat: 功能描述"

# 推送到遠端
git push

# 拉取最新代碼
git pull

# 創建新分支
git checkout -b feature/new-feature

# 切換分支
git checkout master

# 合併分支
git merge feature/new-feature
```

## Commit 訊息規範

建議使用以下格式：

- `feat:` 新功能
- `fix:` 修復錯誤
- `docs:` 文檔更新
- `style:` 格式調整
- `refactor:` 重構代碼
- `test:` 測試相關
- `chore:` 維護任務

範例：
```bash
git commit -m "feat: 新增施工照片上傳功能"
git commit -m "fix: 修復登入驗證問題"
git commit -m "docs: 更新部署文檔"
```

## 故障排除

### 權限問題
```bash
# 如果推送失敗，檢查認證
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# 使用 Personal Access Token
# GitHub → Settings → Developer settings → Personal access tokens
```

### 衝突解決
```bash
# 拉取最新代碼
git pull origin master

# 解決衝突後
git add .
git commit -m "resolve: 解決合併衝突"
git push
```

## 下一步

1. 創建 GitHub Repository
2. 推送代碼
3. 設定 Secrets
4. 確認 GitHub Actions 部署成功
5. 設定自訂網域（可選）

完成後，每次推送到 master/main 分支都會自動部署到 Cloudflare Workers！