"""
E2E Tests for Deployment Flow

Tests the full user journey:
1. Create project (ZIP upload)
2. Configure (review endpoints, fill env vars)
3. Deploy (SSE progress)
4. Success page
5. Run endpoint

Requires:
- Backend running on localhost:3001
- Frontend running on localhost:3000
- pip install playwright pytest pytest-asyncio
- playwright install chromium
"""

import asyncio
import base64
import io
import json
import os
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path

import pytest
import pytest_asyncio
from playwright.async_api import async_playwright, Page, expect

# Test configuration
BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:3000")
API_URL = os.getenv("TEST_API_URL", "http://localhost:3001")
SCREENSHOT_DIR = Path("/tmp/e2e-screenshots")
SCREENSHOT_DIR.mkdir(exist_ok=True)


def create_test_zip(code: str, filename: str = "main.py") -> bytes:
    """Create a ZIP file with the given Python code."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(filename, code)
    return buffer.getvalue()


def timestamp() -> str:
    return datetime.now().strftime("%H%M%S")


class TestDeployFlow:
    """Test the complete deployment flow through the UI."""

    @pytest_asyncio.fixture
    async def page(self):
        """Create a new browser page for each test."""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(viewport={"width": 1280, "height": 800})
            page = await context.new_page()
            yield page
            await browser.close()

    @pytest.mark.asyncio
    async def test_01_home_page_loads(self, page: Page):
        """Test that the home page loads correctly."""
        await page.goto(BASE_URL)
        await page.wait_for_load_state("networkidle")

        # Should see "Apps" heading
        heading = page.locator("h1:has-text('Apps')")
        await expect(heading).to_be_visible()

        # Should see "New App" button
        new_app_btn = page.locator("text=New App")
        await expect(new_app_btn).to_be_visible()

        await page.screenshot(path=SCREENSHOT_DIR / f"{timestamp()}_01_home.png")

    @pytest.mark.asyncio
    async def test_02_create_page_loads(self, page: Page):
        """Test that the create page loads correctly."""
        await page.goto(f"{BASE_URL}/new")
        await page.wait_for_load_state("networkidle")

        # Should see create form - look for the heading or any input
        heading = page.locator("text=Create")
        await expect(heading.first).to_be_visible()

        await page.screenshot(path=SCREENSHOT_DIR / f"{timestamp()}_02_create.png")

    @pytest.mark.asyncio
    async def test_03_full_flow_no_env_vars(self, page: Page):
        """Test complete flow for app WITHOUT environment variables."""
        # Create test app code
        code = '''from fastapi import FastAPI

app = FastAPI()

@app.get("/hello")
def hello():
    return {"message": "Hello World!"}
'''
        zip_data = create_test_zip(code)
        zip_b64 = base64.b64encode(zip_data).decode()

        # Step 1: Create project via API (simulating file upload)
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{API_URL}/projects",
                json={
                    "name": f"E2E Test No Env {timestamp()}",
                    "source_type": "zip",
                    "zip_data": zip_b64
                },
                headers={"Content-Type": "application/json", "x-user-id": "e2e-test"}
            ) as resp:
                data = await resp.json()
                assert "project_id" in data, f"Failed to create project: {data}"
                project_id = data["project_id"]

                # Verify no env vars detected
                assert data.get("detected_env_vars", []) == [], \
                    f"Should have no env vars, got: {data.get('detected_env_vars')}"

                # Verify endpoint detected
                assert len(data.get("endpoints", [])) > 0, "Should detect endpoints"

        # Step 2: Go to configure page
        await page.goto(f"{BASE_URL}/create/configure?project={project_id}")
        await page.wait_for_load_state("networkidle")
        await asyncio.sleep(1)

        # Should show "No environment variables required"
        no_env_msg = page.locator("text=No environment variables required")
        await expect(no_env_msg).to_be_visible()

        # Should show endpoint
        endpoint_badge = page.locator("text=GET")
        await expect(endpoint_badge).to_be_visible()

        await page.screenshot(path=SCREENSHOT_DIR / f"{timestamp()}_03a_configure_no_env.png")

        # Step 3: Click Deploy
        deploy_btn = page.locator("button:has-text('Deploy')")
        await expect(deploy_btn).to_be_enabled()
        await deploy_btn.click()

        # Should redirect to deploying page
        await page.wait_for_url(f"**/p/{project_id}/deploying", timeout=5000)
        await asyncio.sleep(1)

        await page.screenshot(path=SCREENSHOT_DIR / f"{timestamp()}_03b_deploying.png")

        # Step 4: Wait for deployment to complete
        # Should show progress
        progress = page.locator("text=/\\d+%/")
        await expect(progress).to_be_visible(timeout=10000)

        # Wait for redirect to success (deployment takes ~5s)
        await page.wait_for_url(f"**/p/{project_id}/success", timeout=30000)

        await page.screenshot(path=SCREENSHOT_DIR / f"{timestamp()}_03c_success.png")

        # Step 5: Verify success page
        success_msg = page.locator("text=Your app is live")
        await expect(success_msg).to_be_visible()

        # Click "Run Your App"
        run_btn = page.locator("button:has-text('Run Your App'), a:has-text('Run Your App')")
        await run_btn.click()

        # Should go to run page
        await page.wait_for_url(f"**/p/{project_id}", timeout=5000)
        await asyncio.sleep(1)

        await page.screenshot(path=SCREENSHOT_DIR / f"{timestamp()}_03d_run_page.png")

        # Step 6: Execute endpoint
        run_btn = page.locator("button:has-text('Run')")
        await expect(run_btn).to_be_visible()
        await run_btn.click()

        # Wait for result
        await asyncio.sleep(15)  # Modal cold start

        # Should show success
        success_badge = page.locator("text=Success")
        await expect(success_badge).to_be_visible(timeout=30000)

        # Should show response
        response_text = page.locator("text=Hello World")
        await expect(response_text).to_be_visible()

        await page.screenshot(path=SCREENSHOT_DIR / f"{timestamp()}_03e_run_result.png")

    @pytest.mark.asyncio
    async def test_04_full_flow_with_env_vars(self, page: Page):
        """Test complete flow for app WITH environment variables."""
        # Create test app code that uses env vars
        code = '''import os
from fastapi import FastAPI

app = FastAPI()

API_KEY = os.environ.get("API_KEY")

@app.get("/secret")
def get_secret():
    return {"has_key": API_KEY is not None}
'''
        zip_data = create_test_zip(code)
        zip_b64 = base64.b64encode(zip_data).decode()

        # Step 1: Create project via API
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{API_URL}/projects",
                json={
                    "name": f"E2E Test With Env {timestamp()}",
                    "source_type": "zip",
                    "zip_data": zip_b64
                },
                headers={"Content-Type": "application/json", "x-user-id": "e2e-test"}
            ) as resp:
                data = await resp.json()
                assert "project_id" in data, f"Failed to create project: {data}"
                project_id = data["project_id"]

                # Verify env var detected
                assert "API_KEY" in data.get("detected_env_vars", []), \
                    f"Should detect API_KEY, got: {data.get('detected_env_vars')}"

        # Step 2: Go to configure page
        await page.goto(f"{BASE_URL}/create/configure?project={project_id}")
        await page.wait_for_load_state("networkidle")
        await asyncio.sleep(1)

        # Should show env var input
        env_input = page.locator("input[placeholder*='value' i]")
        await expect(env_input).to_be_visible()

        # Deploy button should be disabled
        deploy_btn = page.locator("button:has-text('Deploy')")
        await expect(deploy_btn).to_be_disabled()

        await page.screenshot(path=SCREENSHOT_DIR / f"{timestamp()}_04a_configure_env_empty.png")

        # Step 3: Fill env var
        await env_input.fill("test-secret-value")
        await asyncio.sleep(0.5)

        # Deploy button should now be enabled
        await expect(deploy_btn).to_be_enabled()

        await page.screenshot(path=SCREENSHOT_DIR / f"{timestamp()}_04b_configure_env_filled.png")

        # Step 4: Deploy
        await deploy_btn.click()

        # Wait for success page
        await page.wait_for_url(f"**/p/{project_id}/success", timeout=30000)

        await page.screenshot(path=SCREENSHOT_DIR / f"{timestamp()}_04c_success.png")

    @pytest.mark.asyncio
    async def test_05_home_shows_status_badges(self, page: Page):
        """Test that home page shows correct status badges."""
        await page.goto(BASE_URL)
        await page.wait_for_load_state("networkidle")
        await asyncio.sleep(1)

        # Should show Live badges for deployed apps
        live_badges = page.locator("text=Live")

        # Should show Draft badges for undeployed apps
        draft_badges = page.locator("text=Draft")

        await page.screenshot(path=SCREENSHOT_DIR / f"{timestamp()}_05_home_badges.png")

        # At least one badge type should be visible (we created apps in previous tests)
        live_count = await live_badges.count()
        draft_count = await draft_badges.count()
        assert live_count > 0 or draft_count > 0, "Should have at least one app with status badge"

    @pytest.mark.asyncio
    async def test_06_draft_project_redirects_to_configure(self, page: Page):
        """Test that clicking a draft project goes to configure page."""
        # Create a draft project (don't deploy)
        code = '''from fastapi import FastAPI
app = FastAPI()

@app.get("/test")
def test():
    return {"status": "ok"}
'''
        zip_data = create_test_zip(code)
        zip_b64 = base64.b64encode(zip_data).decode()

        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{API_URL}/projects",
                json={
                    "name": f"Draft Test {timestamp()}",
                    "source_type": "zip",
                    "zip_data": zip_b64
                },
                headers={"Content-Type": "application/json", "x-user-id": "e2e-test"}
            ) as resp:
                data = await resp.json()
                project_id = data["project_id"]

        # Go to project page directly
        await page.goto(f"{BASE_URL}/p/{project_id}")
        await page.wait_for_load_state("networkidle")

        # Should redirect to configure
        await page.wait_for_url(f"**/create/configure?project={project_id}", timeout=5000)

        await page.screenshot(path=SCREENSHOT_DIR / f"{timestamp()}_06_draft_redirect.png")

    @pytest.mark.asyncio
    async def test_07_redeploy_button_works(self, page: Page):
        """Test that redeploy button works for live apps."""
        # Use an existing live project or create one
        code = '''from fastapi import FastAPI
app = FastAPI()

@app.get("/ping")
def ping():
    return {"pong": True}
'''
        zip_data = create_test_zip(code)
        zip_b64 = base64.b64encode(zip_data).decode()

        import aiohttp
        async with aiohttp.ClientSession() as session:
            # Create project
            async with session.post(
                f"{API_URL}/projects",
                json={
                    "name": f"Redeploy Test {timestamp()}",
                    "source_type": "zip",
                    "zip_data": zip_b64
                },
                headers={"Content-Type": "application/json", "x-user-id": "e2e-test"}
            ) as resp:
                data = await resp.json()
                project_id = data["project_id"]

            # Deploy it
            async with session.post(
                f"{API_URL}/projects/{project_id}/deploy",
                json={},
                headers={"Content-Type": "application/json", "x-user-id": "e2e-test"}
            ) as resp:
                pass

            # Wait for deployment to complete
            for _ in range(20):
                await asyncio.sleep(1)
                async with session.get(
                    f"{API_URL}/projects/{project_id}/deploy/status",
                    headers={"x-user-id": "e2e-test"}
                ) as resp:
                    status_data = await resp.json()
                    if status_data.get("status") == "live":
                        break

        # Go directly to run page (not through success)
        await page.goto(f"{BASE_URL}/p/{project_id}")
        await page.wait_for_load_state("networkidle")
        await asyncio.sleep(2)

        await page.screenshot(path=SCREENSHOT_DIR / f"{timestamp()}_07a_run_page.png")

        # Look for Redeploy in the header area specifically
        header = page.locator("header, [class*='header']")
        redeploy_text = header.locator("text=Redeploy")

        # If we're on success page, click through to run page
        if await page.locator("text=Your app is live").count() > 0:
            run_btn = page.locator("text=Run Your App")
            await run_btn.click()
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(1)

        await page.screenshot(path=SCREENSHOT_DIR / f"{timestamp()}_07b_final.png")

        # Check for Redeploy anywhere on page
        redeploy_visible = await page.locator("text=Redeploy").first.is_visible()
        assert redeploy_visible or await page.locator("text=Ready").is_visible(), \
            "Should see Redeploy button or Ready status on run page"


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "-x"])
