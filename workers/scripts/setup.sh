#!/bin/bash

# Construction Management Workers - Setup Script
# This script helps set up the Cloudflare Workers environment

echo "======================================"
echo "工程管理系統 - Cloudflare Workers 設置"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${YELLOW}Wrangler CLI 未安裝。正在安裝...${NC}"
    npm install -g wrangler
fi

# Check if logged in to Cloudflare
echo -e "${YELLOW}檢查 Cloudflare 登入狀態...${NC}"
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}請登入 Cloudflare:${NC}"
    wrangler login
fi

echo ""
echo -e "${GREEN}✓ Cloudflare 登入成功${NC}"
echo ""

# Create KV namespaces
echo -e "${YELLOW}創建 KV Namespaces...${NC}"
echo ""

echo "創建 SESSIONS namespace..."
SESSIONS_OUTPUT=$(wrangler kv:namespace create "SESSIONS" 2>&1)
SESSIONS_ID=$(echo "$SESSIONS_OUTPUT" | grep -oP 'id = "\K[^"]+')
echo -e "${GREEN}✓ SESSIONS KV created with ID: $SESSIONS_ID${NC}"
echo ""

echo "創建 USERS namespace..."
USERS_OUTPUT=$(wrangler kv:namespace create "USERS" 2>&1)
USERS_ID=$(echo "$USERS_OUTPUT" | grep -oP 'id = "\K[^"]+')
echo -e "${GREEN}✓ USERS KV created with ID: $USERS_ID${NC}"
echo ""

echo "創建 FILES_KV namespace..."
FILES_OUTPUT=$(wrangler kv:namespace create "FILES_KV" 2>&1)
FILES_ID=$(echo "$FILES_OUTPUT" | grep -oP 'id = "\K[^"]+')
echo -e "${GREEN}✓ FILES_KV created with ID: $FILES_ID${NC}"
echo ""

# Create R2 bucket
echo -e "${YELLOW}創建 R2 Bucket...${NC}"
wrangler r2 bucket create construction-photos
echo -e "${GREEN}✓ R2 bucket 'construction-photos' created${NC}"
echo ""

# Generate JWT secret
echo -e "${YELLOW}生成 JWT Secret...${NC}"
JWT_SECRET=$(openssl rand -base64 32)
echo -e "${GREEN}✓ JWT Secret generated: $JWT_SECRET${NC}"
echo ""

# Update wrangler.toml
echo -e "${YELLOW}更新 wrangler.toml...${NC}"

# Create backup
cp wrangler.toml wrangler.toml.backup

# Update the file with actual IDs
sed -i.bak "s/id = \"sessions_kv_namespace_id\"/id = \"$SESSIONS_ID\"/" wrangler.toml
sed -i.bak "s/id = \"users_kv_namespace_id\"/id = \"$USERS_ID\"/" wrangler.toml
sed -i.bak "s/id = \"files_kv_namespace_id\"/id = \"$FILES_ID\"/" wrangler.toml
sed -i.bak "s/JWT_SECRET = \"your-jwt-secret-key-change-in-production\"/JWT_SECRET = \"$JWT_SECRET\"/" wrangler.toml

echo -e "${GREEN}✓ wrangler.toml 已更新${NC}"
echo ""

# Save configuration
echo "======================================"
echo "配置摘要"
echo "======================================"
echo ""
echo "KV Namespace IDs:"
echo "  SESSIONS: $SESSIONS_ID"
echo "  USERS: $USERS_ID"
echo "  FILES_KV: $FILES_ID"
echo ""
echo "R2 Bucket: construction-photos"
echo ""
echo "JWT Secret: $JWT_SECRET"
echo ""

# Save to config file
cat > setup-config.txt << EOF
Configuration Summary - $(date)
================================

KV Namespace IDs:
  SESSIONS: $SESSIONS_ID
  USERS: $USERS_ID
  FILES_KV: $FILES_ID

R2 Bucket: construction-photos

JWT Secret: $JWT_SECRET

Next Steps:
1. Run 'npm install' to install dependencies
2. Run 'npm run dev' to start development server
3. Run 'npm run deploy' to deploy to production
EOF

echo -e "${GREEN}配置已保存到 setup-config.txt${NC}"
echo ""

echo "======================================"
echo -e "${GREEN}設置完成！${NC}"
echo "======================================"
echo ""
echo "下一步："
echo "1. 執行 'npm install' 安裝依賴"
echo "2. 執行 'npm run dev' 啟動開發服務器"
echo "3. 執行 'npm run deploy' 部署到生產環境"
echo ""