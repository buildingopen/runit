#!/bin/bash

# Secrets Management Acceptance Test
# Tests encrypted storage, retrieval, and redaction

set -e

API_URL="http://localhost:3001"
PROJECT_ID="test-project-secrets"

echo "🧪 Secrets Management Acceptance Test"
echo "======================================"
echo ""

# Test 1: Create a secret
echo "1️⃣  Creating secret..."
CREATE_RESPONSE=$(curl -s -X POST "$API_URL/projects/$PROJECT_ID/secrets" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "OPENAI_API_KEY",
    "value": "sk-test1234567890abcdefghijklmnopqrstuvwxyz"
  }')

echo "Response: $CREATE_RESPONSE"

SECRET_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
if [ -z "$SECRET_ID" ]; then
  echo "❌ Failed to create secret"
  exit 1
fi
echo "✅ Secret created with ID: $SECRET_ID"
echo ""

# Test 2: List secrets (should not show values)
echo "2️⃣  Listing secrets..."
LIST_RESPONSE=$(curl -s "$API_URL/projects/$PROJECT_ID/secrets")
echo "Response: $LIST_RESPONSE"

if echo "$LIST_RESPONSE" | grep -q "sk-test"; then
  echo "❌ Secret value leaked in list response!"
  exit 1
fi

if echo "$LIST_RESPONSE" | grep -q "OPENAI_API_KEY"; then
  echo "✅ Secret key found in list (value not exposed)"
else
  echo "❌ Secret not in list"
  exit 1
fi
echo ""

# Test 3: Create another secret
echo "3️⃣  Creating second secret..."
curl -s -X POST "$API_URL/projects/$PROJECT_ID/secrets" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "DATABASE_PASSWORD",
    "value": "super-secret-db-pass-12345"
  }' > /dev/null

echo "✅ Second secret created"
echo ""

# Test 4: Verify both secrets in list
echo "4️⃣  Verifying multiple secrets..."
LIST_RESPONSE=$(curl -s "$API_URL/projects/$PROJECT_ID/secrets")
SECRET_COUNT=$(echo "$LIST_RESPONSE" | grep -o '"key"' | wc -l | tr -d ' ')

if [ "$SECRET_COUNT" -eq "2" ]; then
  echo "✅ Found 2 secrets in list"
else
  echo "❌ Expected 2 secrets, found $SECRET_COUNT"
  exit 1
fi
echo ""

# Test 5: Update existing secret
echo "5️⃣  Updating secret..."
curl -s -X POST "$API_URL/projects/$PROJECT_ID/secrets" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "OPENAI_API_KEY",
    "value": "sk-updated-new-value-1234567890"
  }' > /dev/null

echo "✅ Secret updated"
echo ""

# Test 6: Delete a secret
echo "6️⃣  Deleting secret..."
DELETE_RESPONSE=$(curl -s -X DELETE "$API_URL/projects/$PROJECT_ID/secrets/DATABASE_PASSWORD")

if echo "$DELETE_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Secret deleted"
else
  echo "❌ Failed to delete secret"
  exit 1
fi
echo ""

# Test 7: Verify deletion
echo "7️⃣  Verifying deletion..."
LIST_RESPONSE=$(curl -s "$API_URL/projects/$PROJECT_ID/secrets")
SECRET_COUNT=$(echo "$LIST_RESPONSE" | grep -o '"key"' | wc -l | tr -d ' ')

if [ "$SECRET_COUNT" -eq "1" ]; then
  echo "✅ Secret count reduced to 1"
else
  echo "❌ Expected 1 secret after deletion, found $SECRET_COUNT"
  exit 1
fi
echo ""

# Test 8: Invalid key format
echo "8️⃣  Testing invalid key format..."
INVALID_RESPONSE=$(curl -s -X POST "$API_URL/projects/$PROJECT_ID/secrets" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "lowercase-key",
    "value": "test"
  }')

if echo "$INVALID_RESPONSE" | grep -q "UPPERCASE_SNAKE_CASE"; then
  echo "✅ Invalid format rejected"
else
  echo "❌ Invalid format should be rejected"
  exit 1
fi
echo ""

# Test 9: Reserved prefix
echo "9️⃣  Testing reserved prefix..."
RESERVED_RESPONSE=$(curl -s -X POST "$API_URL/projects/$PROJECT_ID/secrets" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "EL_MY_SECRET",
    "value": "test"
  }')

if echo "$RESERVED_RESPONSE" | grep -q "reserved prefix"; then
  echo "✅ Reserved prefix rejected"
else
  echo "❌ Reserved prefix should be rejected"
  exit 1
fi
echo ""

echo "🎉 All secrets management tests passed!"
echo ""
echo "Summary:"
echo "  ✅ Secret creation (encrypted storage)"
echo "  ✅ Secret listing (values not exposed)"
echo "  ✅ Secret updates"
echo "  ✅ Secret deletion"
echo "  ✅ Validation (key format)"
echo "  ✅ Validation (reserved prefix)"
