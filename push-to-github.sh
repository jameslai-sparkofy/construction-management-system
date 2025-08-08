#!/bin/bash

# GitHub 推送腳本
# 請先在 GitHub 上創建 repository

echo "🚀 準備推送到 GitHub..."
echo ""
echo "⚠️  請確保您已經："
echo "1. 在 GitHub 上創建了新的 repository"
echo "2. 複製了 repository 的 URL"
echo ""

# 檢查是否已有遠端設定
if git remote | grep -q "origin"; then
    echo "📌 偵測到已存在的遠端設定："
    git remote -v
    echo ""
    read -p "是否要更新遠端 URL？ (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "請輸入新的 GitHub repository URL: " REPO_URL
        git remote set-url origin "$REPO_URL"
        echo "✅ 遠端 URL 已更新"
    fi
else
    echo "請輸入您的 GitHub repository URL"
    echo "格式範例："
    echo "  HTTPS: https://github.com/username/repository-name.git"
    echo "  SSH:   git@github.com:username/repository-name.git"
    echo ""
    read -p "Repository URL: " REPO_URL
    
    if [ -z "$REPO_URL" ]; then
        echo "❌ URL 不能為空"
        exit 1
    fi
    
    git remote add origin "$REPO_URL"
    echo "✅ 遠端設定已添加"
fi

echo ""
echo "📊 準備推送的分支和提交："
git branch --show-current
git log --oneline -3
echo ""

# 確認推送
read -p "確定要推送到 GitHub？ (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 推送已取消"
    exit 1
fi

# 推送到 GitHub
echo ""
echo "⬆️  開始推送..."
git push -u origin master

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 推送成功！"
    echo ""
    echo "📋 下一步："
    echo "1. 前往 GitHub repository 頁面確認代碼已上傳"
    echo "2. 設定 GitHub Secrets (Settings → Secrets and variables → Actions)"
    echo "   - CLOUDFLARE_API_TOKEN"
    echo "   - FX_API_TOKEN (值: fx-crm-api-secret-2025)"
    echo "   - JWT_SECRET"
    echo "3. 啟用 GitHub Actions"
    echo "4. 執行部署腳本："
    echo "   cd workers && npm run deploy:production"
else
    echo ""
    echo "❌ 推送失敗"
    echo ""
    echo "可能的解決方案："
    echo "1. 檢查網路連線"
    echo "2. 確認 GitHub repository 已創建"
    echo "3. 檢查您的 GitHub 認證 (用戶名/密碼 或 SSH key)"
    echo ""
    echo "如果使用 HTTPS，可能需要設定個人存取權杖："
    echo "https://github.com/settings/tokens"
fi