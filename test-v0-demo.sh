#!/bin/bash
#
# Execution Layer v0 - End-to-End Demo
# Tests the full flow: create project → upload code → execute endpoint → get results
#

set -e

API="http://localhost:3001"
PROJECT_ID="demo-project-$(date +%s)"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Execution Layer v0 - End-to-End Demo                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 1. Check API health
echo "1️⃣  Checking API health..."
curl -s $API/health | jq .
echo ""

# 2. Get API info
echo "2️⃣  Getting API info..."
curl -s $API/ | jq .
echo ""

# 3. Create a sample FastAPI project
echo "3️⃣  Creating sample FastAPI project..."
TMP_DIR=$(mktemp -d)
cat > $TMP_DIR/main.py <<'EOF'
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class CompanyRequest(BaseModel):
    url: str

class CompanyResponse(BaseModel):
    name: str
    description: str
    industry: str

@app.get("/")
def health():
    return {"status": "ok", "message": "Sample FastAPI app is running"}

@app.post("/extract_company")
def extract_company(req: CompanyRequest) -> CompanyResponse:
    """
    Extract company info from a URL.
    (Simplified for demo - returns mock data)
    """
    return CompanyResponse(
        name="ACME Inc",
        description="Enterprise software company",
        industry="SaaS"
    )
EOF

cat > $TMP_DIR/requirements.txt <<'EOF'
fastapi==0.109.0
pydantic==2.5.0
EOF

echo "   Created sample project at: $TMP_DIR"
echo "   Files:"
ls -la $TMP_DIR/
echo ""

# 4. Create ZIP bundle
echo "4️⃣  Creating ZIP bundle..."
cd $TMP_DIR
zip -q bundle.zip main.py requirements.txt
BUNDLE_B64=$(base64 -i bundle.zip)
cd - > /dev/null
echo "   Bundle size: $(stat -f%z $TMP_DIR/bundle.zip) bytes"
echo ""

# 5. Create project via API
echo "5️⃣  Creating project via API..."
CREATE_RESPONSE=$(curl -s -X POST $API/projects \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Demo Project\",
    \"source_type\": \"zip\",
    \"zip_data\": \"$BUNDLE_B64\"
  }")

echo $CREATE_RESPONSE | jq .
PROJECT_ID=$(echo $CREATE_RESPONSE | jq -r '.project_id // .id // "unknown"')
VERSION_ID=$(echo $CREATE_RESPONSE | jq -r '.version_id // "unknown"')
echo "   Project ID: $PROJECT_ID"
echo "   Version ID: $VERSION_ID"
echo ""

# 6. List endpoints (if OpenAPI extraction works)
echo "6️⃣  Listing endpoints..."
curl -s "$API/projects/$PROJECT_ID/endpoints" | jq . 2>/dev/null || echo "   (OpenAPI extraction not yet implemented - expected)"
echo ""

# 7. Execute endpoint directly (bypass OpenAPI for now)
echo "7️⃣  Executing POST /extract_company endpoint..."
RUN_RESPONSE=$(curl -s -X POST $API/runs \
  -H "Content-Type: application/json" \
  -d "{
    \"project_id\": \"$PROJECT_ID\",
    \"version_id\": \"$VERSION_ID\",
    \"endpoint\": \"POST /extract_company\",
    \"request_data\": {
      \"json\": {
        \"url\": \"https://example.com\"
      }
    },
    \"lane\": \"cpu\"
  }")

echo $RUN_RESPONSE | jq . 2>/dev/null || echo $RUN_RESPONSE
RUN_ID=$(echo $RUN_RESPONSE | jq -r '.run_id // "unknown"')
echo "   Run ID: $RUN_ID"
echo ""

# 8. Get run status
echo "8️⃣  Getting run status..."
sleep 2
curl -s "$API/runs/$RUN_ID" | jq . 2>/dev/null || echo "   (Run endpoint not yet implemented - expected)"
echo ""

# 9. Cleanup
echo "9️⃣  Cleanup..."
rm -rf $TMP_DIR
echo "   Removed temp directory"
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Demo Complete!                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ API is running and accepting requests"
echo "⚠️  Full execution flow requires:"
echo "   - Modal runtime integration (services/runner)"
echo "   - OpenAPI extraction endpoint"
echo "   - Run execution endpoint"
echo ""
echo "📍 API running at: $API"
echo "📍 Logs at: /tmp/control-plane.log"
echo ""
