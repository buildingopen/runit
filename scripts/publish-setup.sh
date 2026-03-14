#!/bin/bash
# RunIt Package Publishing Setup
# Run this ONCE after creating npm and PyPI accounts.
#
# Prerequisites:
#   1. npm account 'buildingopen' at npmjs.com (email: fede@scaile.tech)
#   2. PyPI account 'buildingopen' at pypi.org (email: fede@scaile.tech)
#
# This script:
#   - Creates @buildingopen npm org
#   - Generates npm automation token
#   - Sets GitHub secrets (NPM_TOKEN)
#   - Configures PyPI trusted publisher
#   - Tags and publishes v0.1.0

set -euo pipefail

REPO="buildingopen/runit"
NPM_ORG="buildingopen"

echo "=== RunIt Publish Setup ==="
echo ""

# Step 1: npm login
echo "Step 1: Log into npm..."
npm login --auth-type=web
echo ""

# Step 2: Create @buildingopen org
echo "Step 2: Creating @buildingopen npm org..."
npm org create "$NPM_ORG" 2>/dev/null || echo "@buildingopen org already exists"
echo ""

# Step 3: Create automation token
echo "Step 3: Creating npm automation token..."
NPM_TOKEN=$(npm token create --cidr-allowlist="" --read-only=false 2>/dev/null | grep token | awk '{print $NF}')
if [ -z "$NPM_TOKEN" ]; then
  echo "Could not auto-create token. Create one manually at:"
  echo "  https://www.npmjs.com/settings/buildingopen/tokens/new"
  echo "  Type: Automation, No CIDR"
  read -p "Paste your npm token: " NPM_TOKEN
fi
echo ""

# Step 4: Set GitHub secret
echo "Step 4: Setting NPM_TOKEN GitHub secret..."
echo "$NPM_TOKEN" | gh secret set NPM_TOKEN --repo "$REPO"
echo "NPM_TOKEN set."
echo ""

# Step 5: PyPI trusted publisher
echo "Step 5: PyPI trusted publishing..."
echo "Go to https://pypi.org/manage/account/publishing/ and add:"
echo "  PyPI Project Name: runit"
echo "  Owner: buildingopen"
echo "  Repository: runit"
echo "  Workflow: publish.yml"
echo "  Environment: pypi"
echo ""
read -p "Press Enter when done..."
echo ""

# Step 6: Publish
echo "Step 6: Publishing v0.1.0..."
cd "$(dirname "$0")/.."
git tag v0.1.0
git push origin v0.1.0
echo ""
echo "Done! GitHub Actions will publish:"
echo "  - @buildingopen/client, @buildingopen/cli, @buildingopen/mcp-server to npm"
echo "  - runit to PyPI"
echo "  - ghcr.io/buildingopen/runit:0.1.0 to Docker"
echo ""
echo "Track progress: https://github.com/$REPO/actions"
