#!/bin/bash

# Force deploy the final Worker API

TOKEN="Z8a74MaqCOOSQVUJHWJF7R5JXlrkWix4UxXzpkW4"
WORKER_NAME="construction-management-api-clerk"

echo "🔧 Force deploying Worker..."

# First, try to delete the existing Worker
echo "Removing existing Worker..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler delete "$WORKER_NAME" --force 2>/dev/null || true

# Wait a bit
sleep 2

# Copy the final version to index.js
echo "Preparing deployment..."
cp src/index-final.js src/index.js

# Deploy
echo "Deploying new Worker..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler deploy \
  --name "$WORKER_NAME" \
  --compatibility-date 2024-11-06 \
  --compatibility-flag nodejs_compat

# Wait for deployment
echo "Waiting for deployment to propagate..."
sleep 5

# Test
echo -e "\n📊 Testing deployment:"
echo "1. Health check:"
curl -s "https://$WORKER_NAME.lai-jameslai.workers.dev/health" | python3 -m json.tool

echo -e "\n2. Create demo:"
curl -s "https://$WORKER_NAME.lai-jameslai.workers.dev/create-demo" | python3 -m json.tool

echo -e "\n✅ Deployment complete!"