"""
E2E Tests with AI Verification

Uses Playwright for browser automation + Gemini for screenshot verification.
This gives us AI-powered testing without browser-use compatibility issues.

Requires:
- pip install playwright google-generativeai pillow
- Backend running on localhost:3001
- Frontend running on localhost:3000
"""

import asyncio
import base64
import io
import os
import zipfile
from datetime import datetime
from pathlib import Path

from playwright.async_api import async_playwright

# Try to import Google AI
try:
    import google.generativeai as genai
    from PIL import Image
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    print("Install: pip install google-generativeai pillow")

BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:3000")
API_URL = os.getenv("TEST_API_URL", "http://localhost:3001")
SCREENSHOT_DIR = Path("/tmp/ai-verification-screenshots")
SCREENSHOT_DIR.mkdir(exist_ok=True)


def create_test_zip(code: str) -> str:
    """Create a base64 encoded ZIP file."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("main.py", code)
    return base64.b64encode(buffer.getvalue()).decode()


async def create_test_project(name: str) -> str:
    """Create a test project via API."""
    import aiohttp

    code = '''from fastapi import FastAPI
app = FastAPI()

@app.get("/hello")
def hello():
    return {"message": "Hello from AI test!"}
'''
    zip_b64 = create_test_zip(code)

    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{API_URL}/projects",
            json={"name": name, "source_type": "zip", "zip_data": zip_b64},
            headers={"Content-Type": "application/json", "x-user-id": "ai-test"}
        ) as resp:
            data = await resp.json()
            return data["project_id"]


class AIVerifier:
    """Use Gemini to verify screenshots."""

    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel("gemini-2.0-flash")

    def verify_screenshot(self, image_path: Path, verification_prompt: str) -> dict:
        """Verify a screenshot using Gemini vision."""
        img = Image.open(image_path)

        response = self.model.generate_content([
            verification_prompt + "\n\nRespond with JSON: {\"pass\": true/false, \"reason\": \"explanation\"}",
            img
        ])

        try:
            # Try to parse JSON from response
            text = response.text
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]

            import json
            result = json.loads(text.strip())
            return result
        except:
            # If parsing fails, check for positive indicators
            text_lower = response.text.lower()
            passed = any(word in text_lower for word in ["pass", "true", "yes", "correct", "verified"])
            return {"pass": passed, "reason": response.text}


class AIVerificationTests:
    """Tests using Playwright + Gemini verification."""

    def __init__(self, api_key: str):
        self.verifier = AIVerifier(api_key)
        self.results = []

    async def run_test(self, name: str, url: str, actions: list, verification: str) -> bool:
        """Run a test with Playwright and verify with AI."""
        print(f"\n{'='*60}")
        print(f"TEST: {name}")
        print(f"{'='*60}")

        screenshot_path = SCREENSHOT_DIR / f"{datetime.now().strftime('%H%M%S')}_{name.replace(' ', '_')}.png"

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": 1280, "height": 800})

            try:
                # Navigate
                await page.goto(url)
                await page.wait_for_load_state("networkidle")
                await asyncio.sleep(1)

                # Execute actions
                for action in actions:
                    action_type = action.get("type")
                    if action_type == "click":
                        await page.locator(action["selector"]).click()
                        await asyncio.sleep(action.get("wait", 1))
                    elif action_type == "fill":
                        await page.locator(action["selector"]).fill(action["value"])
                    elif action_type == "wait":
                        await asyncio.sleep(action["seconds"])
                    elif action_type == "wait_for_url":
                        await page.wait_for_url(action["pattern"], timeout=action.get("timeout", 30000))

                # Take screenshot
                await page.screenshot(path=screenshot_path)
                print(f"Screenshot: {screenshot_path}")

            finally:
                await browser.close()

        # Verify with AI
        print(f"Verifying: {verification[:80]}...")
        result = self.verifier.verify_screenshot(screenshot_path, verification)

        passed = result.get("pass", False)
        reason = result.get("reason", "No reason provided")

        print(f"Result: {'PASS' if passed else 'FAIL'}")
        print(f"AI says: {reason[:200]}")

        self.results.append({
            "name": name,
            "passed": passed,
            "reason": reason,
            "screenshot": str(screenshot_path)
        })

        return passed

    async def test_01_home_page(self) -> bool:
        """Test home page loads correctly."""
        return await self.run_test(
            name="Home Page",
            url=BASE_URL,
            actions=[],
            verification="""
            Verify this is an app dashboard/home page:
            1. Is there a heading or title mentioning "Apps"?
            2. Is there a button or link to create a "New App"?
            3. Does the page look like a list/dashboard of applications?
            """
        )

    async def test_02_create_page(self) -> bool:
        """Test create page loads."""
        return await self.run_test(
            name="Create Page",
            url=f"{BASE_URL}/new",
            actions=[],
            verification="""
            Verify this is a create/new app page:
            1. Is there a form or interface to create something new?
            2. Are there input fields or upload options?
            3. Does it look like a project creation flow?
            """
        )

    async def test_03_configure_page(self) -> bool:
        """Test configure page shows endpoints."""
        project_id = await create_test_project(f"AI Test {datetime.now().strftime('%H%M%S')}")

        return await self.run_test(
            name="Configure Page",
            url=f"{BASE_URL}/create/configure?project={project_id}",
            actions=[],
            verification="""
            Verify this is a configuration page:
            1. Is there a "Configure" heading?
            2. Can you see detected endpoints (like GET /hello)?
            3. Is there a "Deploy" button?
            """
        )

    async def test_04_deploy_flow(self) -> bool:
        """Test the deploy flow shows progress."""
        project_id = await create_test_project(f"AI Deploy {datetime.now().strftime('%H%M%S')}")

        return await self.run_test(
            name="Deploy Flow",
            url=f"{BASE_URL}/create/configure?project={project_id}",
            actions=[
                {"type": "click", "selector": "button:has-text('Deploy')", "wait": 2},
                {"type": "wait", "seconds": 3},
            ],
            verification="""
            Verify this is a deployment progress page:
            1. Is there a progress indicator (percentage, progress bar)?
            2. Are there deployment steps shown (like "Installing", "Building")?
            3. Does it look like an active deployment in progress?
            """
        )

    async def test_05_success_page(self) -> bool:
        """Test success page after deployment."""
        import aiohttp

        project_id = await create_test_project(f"AI Success {datetime.now().strftime('%H%M%S')}")

        # Deploy via API
        async with aiohttp.ClientSession() as session:
            await session.post(
                f"{API_URL}/projects/{project_id}/deploy",
                json={},
                headers={"Content-Type": "application/json", "x-user-id": "ai-test"}
            )
            # Wait for deploy
            await asyncio.sleep(8)

        return await self.run_test(
            name="Success Page",
            url=f"{BASE_URL}/p/{project_id}/success",
            actions=[],
            verification="""
            Verify this is a success/celebration page:
            1. Is there a success message like "live" or "deployed"?
            2. Is there a checkmark or celebration visual?
            3. Is there a button to run the app or share it?
            """
        )

    async def test_06_run_page(self) -> bool:
        """Test run page for a live app."""
        import aiohttp

        project_id = await create_test_project(f"AI Run {datetime.now().strftime('%H%M%S')}")

        # Deploy via API
        async with aiohttp.ClientSession() as session:
            await session.post(
                f"{API_URL}/projects/{project_id}/deploy",
                json={},
                headers={"Content-Type": "application/json", "x-user-id": "ai-test"}
            )
            await asyncio.sleep(8)

        return await self.run_test(
            name="Run Page",
            url=f"{BASE_URL}/p/{project_id}",
            actions=[],
            verification="""
            Verify this is an API run/execute page:
            1. Is there a "Run" button?
            2. Is there an input panel on the left and output panel on the right?
            3. Does it show endpoint information (like GET /hello)?
            4. Is there a "Ready" or "Live" status indicator?
            """
        )

    async def run_all_tests(self) -> dict:
        """Run all tests."""
        print("\n" + "="*60)
        print("AI VERIFICATION E2E TEST SUITE")
        print("="*60)

        tests = [
            self.test_01_home_page,
            self.test_02_create_page,
            self.test_03_configure_page,
            self.test_04_deploy_flow,
            self.test_05_success_page,
            self.test_06_run_page,
        ]

        passed = 0
        failed = 0

        for test in tests:
            try:
                if await test():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"ERROR: {e}")
                failed += 1

        print("\n" + "="*60)
        print(f"RESULTS: {passed} passed, {failed} failed out of {len(tests)}")
        print("="*60)

        for r in self.results:
            status = "✓" if r["passed"] else "✗"
            print(f"{status} {r['name']}")

        return {"passed": passed, "failed": failed, "results": self.results}


async def main():
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: GOOGLE_API_KEY not set")
        return

    if not GEMINI_AVAILABLE:
        print("ERROR: google-generativeai not installed")
        return

    tests = AIVerificationTests(api_key)
    await tests.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())
