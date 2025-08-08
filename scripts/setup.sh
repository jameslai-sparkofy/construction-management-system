#!/bin/bash

# 初始設定腳本 - Construction Management System
# 用於初始化專案環境和資源

set -e

echo "🔧 工程管理系統初始設定"
echo "========================"

# 檢查必要工具
echo "📋 檢查環境..."
command -v wrangler >/dev/null 2>&1 || { echo "❌ 需要安裝 wrangler CLI: npm install -g wrangler"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ 需要安裝 Node.js"; exit 1; }

# 登入 Cloudflare
echo "☁️ 登入 Cloudflare..."
wrangler login

# 創建 KV 命名空間
echo "📦 創建 KV 命名空間..."
echo "創建 SESSION_STORE..."
wrangler kv:namespace create "SESSION_STORE" || echo "SESSION_STORE 已存在"

echo "創建 SYNC_STATE..."
wrangler kv:namespace create "SYNC_STATE" || echo "SYNC_STATE 已存在"

# 創建 R2 儲存桶
echo "💾 創建 R2 儲存桶..."
wrangler r2 bucket create construction-photos || echo "construction-photos 儲存桶已存在"

# 初始化資料庫
echo "🗄️ 初始化資料庫..."

# 檢查資料庫是否存在
echo "檢查 D1 資料庫..."
if ! wrangler d1 list | grep -q "fx-crm-database"; then
    echo "創建 fx-crm-database..."
    wrangler d1 create fx-crm-database
else
    echo "fx-crm-database 已存在"
fi

if ! wrangler d1 list | grep -q "engineering-management"; then
    echo "創建 engineering-management..."
    wrangler d1 create engineering-management
else
    echo "engineering-management 已存在"
fi

# 初始化資料庫結構
cd workers
if [ -f "schema-engineering.sql" ]; then
    echo "初始化 engineering-management 資料庫結構..."
    wrangler d1 execute engineering-management --file=./schema-engineering.sql
    echo "✅ 資料庫結構已初始化"
else
    echo "⚠️ 找不到 schema-engineering.sql"
fi

# 安裝依賴
echo "📦 安裝 Node.js 依賴..."
npm install

# 設定環境變數提示
echo ""
echo "🔐 請設定以下環境變數："
echo "========================"
echo ""
echo "1. FX API Token:"
echo "   wrangler secret put FX_API_TOKEN"
echo "   輸入: fx-crm-api-secret-2025"
echo ""
echo "2. JWT Secret:"
echo "   wrangler secret put JWT_SECRET"
echo "   輸入: 您的JWT密鑰（建議使用隨機字串）"
echo ""
echo "3. 更新 wrangler.toml 中的 database_id（如果需要）"
echo ""

# 創建測試用戶
echo "👤 創建測試用戶提示："
echo "========================"
echo "使用以下 SQL 創建測試用戶："
echo ""
cat << 'EOF'
INSERT INTO users (id, phone, password_suffix, name, role, email) VALUES 
('admin-001', '0912345678', '678', '系統管理員', 'admin', 'admin@example.com'),
('leader-001', '0923456789', '789', '工班負責人', 'leader', 'leader@example.com'),
('member-001', '0934567890', '890', '工班成員', 'member', 'member@example.com');
EOF

echo ""
echo "✅ 初始設定完成！"
echo ""
echo "下一步："
echo "1. 設定環境變數（見上方提示）"
echo "2. 運行 npm run dev 開始本地開發"
echo "3. 運行 ./scripts/deploy.sh 部署到生產環境"

cd ..