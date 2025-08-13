#\!/bin/bash
ACCOUNT_ID="7ec5158e2e2e8bce9a69c088395c896d"
API_TOKEN="Z8a74MaqCOOSQVUJHWJF7R5JXlrkWix4UxXzpkW4"
WORKER_NAME="construction-management-api-clerk"

# Read the worker script
SCRIPT_CONTENT=$(cat src/api-final.js)

# Deploy using Cloudflare API
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${WORKER_NAME}" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/javascript" \
  --data-binary "$SCRIPT_CONTENT"
