#!/bin/bash
#
# End-to-End API Test
# Tests the complete flow: Upload → Extract OpenAPI → Execute → Get Result
#

set -e

API_URL="http://localhost:3001"

echo "🧪 E2E API Test - Execution Layer v0"
echo "===================================="
echo ""

# Create test FastAPI app ZIP
echo "1️⃣  Creating test FastAPI app..."
cd "/Users/federicodeponte/Downloads/runtime ai/execution-layer/services/runner/test_app"
zip -q /tmp/test-app.zip main.py
TEST_ZIP_B64=$(base64 < /tmp/test-app.zip)
echo "   ✅ Test app packaged ($(wc -c < /tmp/test-app.zip) bytes)"
echo ""

# Step 1: Create project
echo "2️⃣  Creating project..."
CREATE_RESPONSE=$(curl -s -X POST "$API_URL/projects" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Greeter App\",
    \"source_type\": \"zip\",
    \"zip_data\": \"$TEST_ZIP_B64\"
  }")

PROJECT_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['project_id'])")
VERSION_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['version_id'])")

echo "   ✅ Project created"
echo "      Project ID: $PROJECT_ID"
echo "      Version ID: $VERSION_ID"
echo ""

# Step 2: Extract OpenAPI
echo "3️⃣  Extracting OpenAPI schema..."
OPENAPI_RESPONSE=$(curl -s -X POST "$API_URL/projects/$PROJECT_ID/versions/$VERSION_ID/extract-openapi")

ENDPOINTS_COUNT=$(echo "$OPENAPI_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('endpoints_count', 0))")

echo "   ✅ OpenAPI extracted"
echo "      Endpoints found: $ENDPOINTS_COUNT"
echo ""

# Step 3: List endpoints
echo "4️⃣  Listing available endpoints..."
ENDPOINTS_RESPONSE=$(curl -s "$API_URL/projects/$PROJECT_ID/endpoints")

echo "$ENDPOINTS_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for ep in data.get('endpoints', []):
    print(f\"      - {ep['method']} {ep['path']}\")
"

# Get first endpoint ID
ENDPOINT_ID=$(echo "$ENDPOINTS_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['endpoints'][0]['endpoint_id'])")
echo "      Selected: $ENDPOINT_ID"
echo ""

# Step 4: Execute endpoint
echo "5️⃣  Executing endpoint..."
RUN_RESPONSE=$(curl -s -X POST "$API_URL/runs" \
  -H "Content-Type: application/json" \
  -d "{
    \"project_id\": \"$PROJECT_ID\",
    \"version_id\": \"$VERSION_ID\",
    \"endpoint_id\": \"$ENDPOINT_ID\",
    \"json\": {\"name\": \"E2E Test\"},
    \"lane\": \"cpu\"
  }")

RUN_ID=$(echo "$RUN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['run_id'])")

echo "   ✅ Run created"
echo "      Run ID: $RUN_ID"
echo "      Status: running (executing on Modal...)"
echo ""

# Step 5: Poll for result
echo "6️⃣  Waiting for result..."
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  sleep 2
  ATTEMPT=$((ATTEMPT + 1))

  STATUS_RESPONSE=$(curl -s "$API_URL/runs/$RUN_ID")
  STATUS=$(echo "$STATUS_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['status'])")

  echo "      Attempt $ATTEMPT/$MAX_ATTEMPTS - Status: $STATUS"

  if [ "$STATUS" = "success" ] || [ "$STATUS" = "error" ] || [ "$STATUS" = "timeout" ]; then
    break
  fi
done

echo ""

# Step 6: Display result
echo "7️⃣  Result:"
echo "$STATUS_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
result = data.get('result', {})

print(f\"   Status: {data['status']}\")
print(f\"   Duration: {result.get('duration_ms', 0)}ms\")
print(f\"   HTTP Status: {result.get('http_status', 0)}\")
print(f\"   Response Body:\")
print(f\"      {json.dumps(result.get('response_body'), indent=2)}\")

if data['status'] != 'success':
    print(f\"   Error: {result.get('error_message', 'Unknown')}\")
"

echo ""

# Cleanup
rm /tmp/test-app.zip

if [ "$STATUS" = "success" ]; then
  echo "🎉 E2E TEST PASSED!"
  exit 0
else
  echo "❌ E2E TEST FAILED"
  exit 1
fi
