#!/bin/bash

# 部署腳本 - Construction Management System
# 用於部署 Cloudflare Workers 到生產環境

set -e

echo "🚀 開始部署工程管理系統..."

# 檢查必要工具
command -v wrangler >/dev/null 2>&1 || { echo "❌ 需要安裝 wrangler CLI"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ 需要安裝 Node.js"; exit 1; }

# 進入 workers 目錄
cd workers

# 安裝依賴
echo "📦 安裝依賴..."
npm install

# 運行測試（如果有）
if [ -f "package.json" ] && grep -q "\"test\"" package.json; then
    echo "🧪 運行測試..."
    npm test || { echo "❌ 測試失敗"; exit 1; }
fi

# 檢查 wrangler 配置
if [ ! -f "wrangler.toml" ]; then
    echo "❌ 找不到 wrangler.toml 配置文件"
    exit 1
fi

# 部署到 Cloudflare
echo "☁️ 部署到 Cloudflare Workers..."
wrangler deploy

# 設定環境變數（如果需要）
echo "🔐 檢查環境變數..."
echo "請確保已設定以下 secrets："
echo "  - FX_API_TOKEN"
echo "  - JWT_SECRET"
echo ""
echo "使用以下指令設定："
echo "  wrangler secret put FX_API_TOKEN"
echo "  wrangler secret put JWT_SECRET"

# 驗證部署
echo "✅ 部署完成！"
echo ""
echo "📌 部署資訊："
echo "  Worker URL: https://construction-management-api.workers.dev"
echo "  D1 Databases:"
echo "    - fx-crm-database: 332221d8-61cb-4084-88dc-394e208ae8b4"
echo "    - engineering-management: 21fce5cd-8364-4dc2-be7f-6d68cbd6fca9"
echo ""
echo "📊 查看日誌："
echo "  wrangler tail"
echo ""
echo "🌐 前端頁面："
echo "  請將 frontend/ 目錄的檔案部署到您的網頁伺服器"

# 返回原目錄
cd ..