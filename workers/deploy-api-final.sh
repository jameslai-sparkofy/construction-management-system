#!/bin/bash
export CLOUDFLARE_API_TOKEN="2rj0qA0MMuCcH_4kGvS8vXIRsVhI9MDdO3GB7tGs"
echo "Deploying api-final.js to Cloudflare Workers..."
npx wrangler deploy --config wrangler-api-final.toml
echo "Deployment complete."
echo "Checking health endpoint..."
sleep 5
curl -s https://construction-management-api-clerk.lai-jameslai.workers.dev/health | python3 -m json.tool