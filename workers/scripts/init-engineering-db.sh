#!/bin/bash

# 初始化 Engineering Management D1 資料庫

echo "=== 初始化工程管理資料庫 ==="

# 1. 建立 D1 資料庫
echo "建立 engineering-management 資料庫..."
npx wrangler d1 create engineering-management

# 2. 獲取資料庫 ID
echo "獲取資料庫 ID..."
DB_ID=$(npx wrangler d1 list | grep "engineering-management" | awk '{print $1}')

if [ -z "$DB_ID" ]; then
    echo "錯誤：無法找到資料庫 ID"
    exit 1
fi

echo "資料庫 ID: $DB_ID"

# 3. 更新 wrangler.toml
echo "更新 wrangler.toml..."
sed -i "s/engineering-management-db-id/$DB_ID/" ../wrangler.toml

# 4. 應用資料庫 schema
echo "應用資料庫 schema..."
npx wrangler d1 execute engineering-management --file=../schema-engineering.sql

echo "=== 工程管理資料庫初始化完成 ==="
echo ""
echo "資料庫資訊："
echo "- 名稱: engineering-management"
echo "- ID: $DB_ID"
echo "- Schema: schema-engineering.sql"
echo ""
echo "下一步："
echo "1. 部署 Worker: npm run deploy"
echo "2. 測試連接: npm run test:db"