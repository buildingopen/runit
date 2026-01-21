"""
Browser-Use Product Audit for Execution Layer
Tests the full E2E flow using AI-driven browser automation
"""

import asyncio

from browser_use import Agent
from browser_use.browser.session import BrowserSession
from browser_use.llm.google.chat import ChatGoogle

# Configuration
WEB_APP_URL = "http://localhost:3005"
API_URL = "http://localhost:3001"
GEMINI_API_KEY = "AIzaSyBqWsuG-i3laFKpRTZm5dzcO5_Ry8xMCfs"

async def run_audit():
    """Run comprehensive product audit using browser-use"""

    # Initialize Gemini model using browser-use's native ChatGoogle
    # Using gemini-2.5-flash to avoid rate limits on 2.0-flash
    llm = ChatGoogle(
        model="gemini-2.5-flash",
        api_key=GEMINI_API_KEY
    )

    # Browser session with keep_alive to maintain session between agents
    browser = BrowserSession(
        headless=False,  # Show browser for visual verification
        disable_security=True,
        keep_alive=True
    )

    results = []

    try:
        # ============================================
        # AUDIT 1: Homepage Load Test
        # ============================================
        print("\n" + "="*60)
        print("AUDIT 1: Homepage Load Test")
        print("="*60)

        agent = Agent(
            task=f"""
            Go to {WEB_APP_URL} and wait for the page to fully load (wait at least 3 seconds).

            Then verify the Execution Layer homepage loads correctly:
            1. Look for "Execution Layer" text in the header or page
            2. Check if there is a "New Project" button or link
            3. Look for a "Projects" section with project cards

            Report what you see on the homepage after it has loaded.
            """,
            llm=llm,
            browser=browser
        )

        result1 = await agent.run()
        print(f"Result: {result1}")
        results.append(("Homepage Load", result1))

        # ============================================
        # AUDIT 2: Project Page Test
        # ============================================
        print("\n" + "="*60)
        print("AUDIT 2: Navigate to OpenContext Project")
        print("="*60)

        agent = Agent(
            task=f"""
            Navigate to {WEB_APP_URL}/p/2a9cf3cc-aae7-4447-bb6b-e495a09f4ff4
            Wait for the page to fully load (at least 3 seconds).

            This should show the "opencontext" project page. Verify and report:
            1. The project name "opencontext" is displayed in the header
            2. List ALL the endpoints shown (should be 7 endpoints like GET /, GET /health, POST /api/v1/analyze, etc.)
            3. Note if there are play/run buttons (circle with triangle) next to each endpoint
            4. Check if there's a "Run History" section on the right

            List every endpoint you can see.
            """,
            llm=llm,
            browser=browser
        )

        result2 = await agent.run()
        print(f"Result: {result2}")
        results.append(("Project Page", result2))

        # ============================================
        # AUDIT 3: Run Health Endpoint with Quick Run Button
        # ============================================
        print("\n" + "="*60)
        print("AUDIT 3: Run Health Check Using Quick Run Button")
        print("="*60)

        agent = Agent(
            task=f"""
            On the current project page, run the health check endpoint using the quick-run button.

            Steps:
            1. Find the "GET /" or "GET /health" endpoint row
            2. Look for a circular play button (with triangle icon) on the right side of that endpoint row
            3. Click the play button to run the endpoint
            4. Wait 5-10 seconds for the result to appear
            5. Look for a "Result" section that appears below the endpoints
            6. Report the result - it should show status "healthy" and version "3.0.0"

            If you see a Result section with JSON data, report what it says.
            """,
            llm=llm,
            browser=browser
        )

        result3 = await agent.run()
        print(f"Result: {result3}")
        results.append(("Health Endpoint Run", result3))

        # ============================================
        # AUDIT 4: Check Run History
        # ============================================
        print("\n" + "="*60)
        print("AUDIT 4: Verify Run History")
        print("="*60)

        agent = Agent(
            task=f"""
            On the project page, examine the "Run History" section on the right side.

            Report:
            1. How many runs are shown in the history?
            2. For each run, what is the endpoint, status, and duration?
            3. Are there runs for both GET / and POST /api/v1/analyze?

            List all runs you can see with their details.
            """,
            llm=llm,
            browser=browser
        )

        result4 = await agent.run()
        print(f"Result: {result4}")
        results.append(("Run History", result4))

        # ============================================
        # FINAL SUMMARY
        # ============================================
        print("\n" + "="*60)
        print("AUDIT COMPLETE - SUMMARY")
        print("="*60)

        for name, result in results:
            # Extract the final result text
            final_text = ""
            if hasattr(result, 'all_results') and result.all_results:
                for r in result.all_results:
                    if r.is_done and r.extracted_content:
                        final_text = r.extracted_content
                        break

            print(f"\n{name}:")
            print(f"  {final_text[:500] if final_text else str(result)[:500]}...")

    except Exception as e:
        print(f"Error during audit: {e}")
        import traceback
        traceback.print_exc()
    finally:
        try:
            await browser.stop()
        except:
            pass

if __name__ == "__main__":
    asyncio.run(run_audit())
