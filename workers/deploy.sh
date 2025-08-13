#\!/bin/bash
echo "Starting deployment..."
npx wrangler deploy \
  --name construction-management-api \
  --compatibility-date 2024-11-06 \
  src/index.js
echo "Deployment complete"
