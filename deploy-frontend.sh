#!/bin/bash

# Deploy frontend to Cloudflare Pages
echo "Deploying frontend to Cloudflare Pages..."

cd frontend

# Use the API token that worked before
export CLOUDFLARE_API_TOKEN="Z8a74MaqCOOSQVUJHWJF7R5JXlrkWix4UxXzpkW4"

# Deploy
npx wrangler pages deploy . \
  --project-name construction-management-frontend \
  --branch main \
  --commit-dirty=true

echo "Deployment complete!"