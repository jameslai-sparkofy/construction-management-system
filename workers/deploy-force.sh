#!/bin/bash
export CLOUDFLARE_API_TOKEN="2rj0qA0MMuCcH_4kGvS8vXIRsVhI9MDdO3GB7tGs"

echo "Force deploying to Cloudflare Workers..."
echo "Deleting old worker..."
npx wrangler delete construction-management-api-clerk --force 2>/dev/null || true

echo "Deploying new version..."
npx wrangler deploy --name construction-management-api-clerk --compatibility-date 2024-11-06

echo "Checking health..."
sleep 3
curl -s https://construction-management-api-clerk.lai-jameslai.workers.dev/health | python3 -m json.tool