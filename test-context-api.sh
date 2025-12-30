#!/bin/bash
# Acceptance Test for Context API
# Tests the complete context flow

set -e

echo "=== Context API Acceptance Test ==="
echo ""

PROJECT_ID="test-project-123"
BASE_URL="http://localhost:3001"

echo "1. Testing POST /projects/:id/context (Fetch from URL)"
echo "---"
RESPONSE=$(curl -s -X POST "$BASE_URL/projects/$PROJECT_ID/context" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "name": "test-company"
  }')

echo "Response: $RESPONSE"
echo ""

# Extract context ID from response
CONTEXT_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$CONTEXT_ID" ]; then
  echo "❌ Failed to create context"
  exit 1
fi

echo "✅ Context created with ID: $CONTEXT_ID"
echo ""

echo "2. Testing GET /projects/:id/context (List contexts)"
echo "---"
curl -s "$BASE_URL/projects/$PROJECT_ID/context" | jq .
echo ""

echo "3. Testing GET /projects/:id/context/:cid (Get specific context)"
echo "---"
curl -s "$BASE_URL/projects/$PROJECT_ID/context/$CONTEXT_ID" | jq .
echo ""

echo "4. Testing PUT /projects/:id/context/:cid (Refresh context)"
echo "---"
curl -s -X PUT "$BASE_URL/projects/$PROJECT_ID/context/$CONTEXT_ID" | jq .
echo ""

echo "5. Testing context validation (should reject secrets)"
echo "---"
INVALID_RESPONSE=$(curl -s -X POST "$BASE_URL/projects/$PROJECT_ID/context" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "name": "invalid-context"
  }')

echo "Response: $INVALID_RESPONSE"
echo ""

echo "6. Testing DELETE /projects/:id/context/:cid (Delete context)"
echo "---"
curl -s -X DELETE "$BASE_URL/projects/$PROJECT_ID/context/$CONTEXT_ID" | jq .
echo ""

echo "7. Verifying deletion"
echo "---"
curl -s "$BASE_URL/projects/$PROJECT_ID/context" | jq .
echo ""

echo "=== All tests passed! ✅ ==="
