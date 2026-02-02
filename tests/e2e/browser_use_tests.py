"""
E2E Tests using browser-use (AI-powered browser automation)

These tests use natural language instructions to navigate and verify the UI.
Provides a second layer of testing beyond Playwright.

Requires:
- pip install browser-use
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

# Check if browser-use is available
try:
    from browser_use import Agent
    # Support both Anthropic and Google Gemini
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        USE_GEMINI = True
    except ImportError:
        from langchain_anthropic import ChatAnthropic
        USE_GEMINI = False
    BROWSER_USE_AVAILABLE = True
except ImportError:
    BROWSER_USE_AVAILABLE = False
    print("browser-use not installed. Run: pip install browser-use langchain-google-genai")

BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:3000")
API_URL = os.getenv("TEST_API_URL", "http://localhost:3001")
SCREENSHOT_DIR = Path("/tmp/browser-use-screenshots")
SCREENSHOT_DIR.mkdir(exist_ok=True)


def create_test_zip(code: str) -> str:
    """Create a base64 encoded ZIP file with the given Python code."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("main.py", code)
    return base64.b64encode(buffer.getvalue()).decode()


async def create_test_project(name: str, has_env_vars: bool = False) -> str:
    """Create a test project via API and return project_id."""
    import aiohttp

    if has_env_vars:
        code = '''import os
from fastapi import FastAPI
app = FastAPI()
SECRET = os.environ.get("SECRET_KEY")

@app.get("/check")
def check():
    return {"has_secret": SECRET is not None}
'''
    else:
        code = '''from fastapi import FastAPI
app = FastAPI()

@app.get("/hello")
def hello():
    return {"message": "Hello from browser-use test!"}
'''

    zip_b64 = create_test_zip(code)

    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{API_URL}/projects",
            json={"name": name, "source_type": "zip", "zip_data": zip_b64},
            headers={"Content-Type": "application/json", "x-user-id": "browser-use-test"}
        ) as resp:
            data = await resp.json()
            return data["project_id"]


class BrowserUseTests:
    """Tests using browser-use AI agent."""

    def __init__(self):
        if not BROWSER_USE_AVAILABLE:
            raise RuntimeError("browser-use not installed")

        if USE_GEMINI:
            self.llm = ChatGoogleGenerativeAI(
                model="gemini-2.0-flash-exp",
                google_api_key=os.getenv("GOOGLE_API_KEY"),
            )
        else:
            self.llm = ChatAnthropic(
                model_name="claude-sonnet-4-20250514",
                timeout=60,
                stop=None
            )
        self.results = []

    async def run_test(self, name: str, task: str, success_check: str) -> bool:
        """Run a single test with browser-use agent."""
        print(f"\n{'='*60}")
        print(f"TEST: {name}")
        print(f"{'='*60}")
        print(f"Task: {task}")

        try:
            agent = Agent(
                task=task,
                llm=self.llm,
            )
            result = await agent.run()

            # Check if the task was successful
            success = success_check.lower() in str(result).lower()

            print(f"Result: {'PASS' if success else 'FAIL'}")
            print(f"Agent output: {result}")

            self.results.append({"name": name, "success": success, "result": result})
            return success

        except Exception as e:
            print(f"Result: ERROR - {e}")
            self.results.append({"name": name, "success": False, "error": str(e)})
            return False

    async def test_01_navigate_home(self) -> bool:
        """Test navigating to home page and verifying it loads."""
        return await self.run_test(
            name="Navigate to Home Page",
            task=f"""
            Go to {BASE_URL}

            Verify that:
            1. The page loads successfully
            2. You can see "Apps" somewhere on the page
            3. There is a "New App" button visible

            Report what you see on the page.
            """,
            success_check="apps"
        )

    async def test_02_navigate_to_create(self) -> bool:
        """Test navigating to create page."""
        return await self.run_test(
            name="Navigate to Create Page",
            task=f"""
            Go to {BASE_URL}/new

            Verify that:
            1. You see a form to create a new app
            2. There's a way to upload files or enter a name

            Report what form fields or buttons you see.
            """,
            success_check="create"
        )

    async def test_03_view_configure_page(self) -> bool:
        """Test viewing the configure page for a project."""
        # Create a test project first
        project_id = await create_test_project(f"BU Test {datetime.now().strftime('%H%M%S')}")

        return await self.run_test(
            name="View Configure Page",
            task=f"""
            Go to {BASE_URL}/create/configure?project={project_id}

            Verify that:
            1. You see a "Configure" heading
            2. You can see detected endpoints (should show GET /hello)
            3. There is a "Deploy" button

            Report what you see on the page.
            """,
            success_check="deploy"
        )

    async def test_04_deploy_and_verify_success(self) -> bool:
        """Test the full deploy flow through the UI."""
        project_id = await create_test_project(f"BU Deploy {datetime.now().strftime('%H%M%S')}")

        return await self.run_test(
            name="Deploy App and Verify Success",
            task=f"""
            Go to {BASE_URL}/create/configure?project={project_id}

            1. Click the "Deploy App" button
            2. Wait for the deployment to complete (you should see progress)
            3. You should end up on a success page saying "Your app is live"

            Report if the deployment was successful and what you see.
            """,
            success_check="live"
        )

    async def test_05_run_endpoint(self) -> bool:
        """Test running an endpoint after deployment."""
        import aiohttp

        # Create and deploy a project via API
        project_id = await create_test_project(f"BU Run {datetime.now().strftime('%H%M%S')}")

        async with aiohttp.ClientSession() as session:
            # Deploy
            await session.post(
                f"{API_URL}/projects/{project_id}/deploy",
                json={},
                headers={"Content-Type": "application/json", "x-user-id": "browser-use-test"}
            )
            # Wait for deployment
            await asyncio.sleep(8)

        return await self.run_test(
            name="Run Endpoint",
            task=f"""
            Go to {BASE_URL}/p/{project_id}

            1. You should see a run page with a "Run" button
            2. Click the "Run" button
            3. Wait for the result (may take 10-20 seconds)
            4. You should see "Success" and a response with "Hello"

            Report the result of running the endpoint.
            """,
            success_check="success"
        )

    async def test_06_check_status_badges(self) -> bool:
        """Test that status badges show correctly on home page."""
        return await self.run_test(
            name="Check Status Badges",
            task=f"""
            Go to {BASE_URL}

            Look at the list of apps and check:
            1. Do you see any apps with a "Live" badge (green)?
            2. Do you see any apps with a "Draft" badge (gray)?

            Report how many apps you see and their statuses.
            """,
            success_check="live"
        )

    async def run_all_tests(self) -> dict:
        """Run all browser-use tests."""
        print("\n" + "="*60)
        print("BROWSER-USE E2E TEST SUITE")
        print("="*60)

        tests = [
            self.test_01_navigate_home,
            self.test_02_navigate_to_create,
            self.test_03_view_configure_page,
            self.test_04_deploy_and_verify_success,
            self.test_05_run_endpoint,
            self.test_06_check_status_badges,
        ]

        passed = 0
        failed = 0

        for test in tests:
            try:
                result = await test()
                if result:
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"Test error: {e}")
                failed += 1

        print("\n" + "="*60)
        print(f"RESULTS: {passed} passed, {failed} failed")
        print("="*60)

        return {
            "passed": passed,
            "failed": failed,
            "total": len(tests),
            "results": self.results
        }


async def main():
    """Run the browser-use test suite."""
    if not BROWSER_USE_AVAILABLE:
        print("ERROR: browser-use not installed")
        print("Install with: pip install browser-use langchain-anthropic")
        return

    # Check if API key is set
    if USE_GEMINI:
        if not os.getenv("GOOGLE_API_KEY"):
            print("ERROR: GOOGLE_API_KEY environment variable not set")
            return
    else:
        if not os.getenv("ANTHROPIC_API_KEY"):
            print("ERROR: ANTHROPIC_API_KEY environment variable not set")
            return

    tests = BrowserUseTests()
    results = await tests.run_all_tests()

    # Print summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    for r in results["results"]:
        status = "✓ PASS" if r.get("success") else "✗ FAIL"
        print(f"{status}: {r['name']}")

    return results


if __name__ == "__main__":
    asyncio.run(main())
