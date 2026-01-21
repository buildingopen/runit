#!/usr/bin/env python3
"""
Product Audit using browser-use with native Gemini support
"""

import asyncio
import os
from datetime import datetime

# Set up Gemini API key
os.environ["GOOGLE_API_KEY"] = "REDACTED_API_KEY"

from browser_use import Agent, BrowserSession, BrowserProfile
from browser_use.llm.google import ChatGoogle


async def run_audit_task(browser_session, llm, task_name: str, task: str) -> dict:
    """Run a single audit task"""
    print(f"\n{'='*60}")
    print(f"Running: {task_name}")
    print("=" * 60)

    try:
        agent = Agent(
            task=task,
            llm=llm,
            browser_session=browser_session,
            use_vision=True,
            max_failures=3,
        )

        result = await agent.run(max_steps=15)

        print(f"\n{task_name} - COMPLETED")
        print("-" * 40)

        # Extract the final result
        final_result = ""
        if result and hasattr(result, 'final_result'):
            final_result = str(result.final_result())
        elif result:
            final_result = str(result)

        print(final_result[:2000] if final_result else "No result text")

        return {
            "name": task_name,
            "status": "completed",
            "result": final_result
        }

    except Exception as e:
        print(f"\n{task_name} - ERROR: {e}")
        import traceback
        traceback.print_exc()
        return {
            "name": task_name,
            "status": "error",
            "error": str(e)
        }


async def run_product_audit():
    """Run comprehensive product audit using browser-use with Gemini"""

    print("=" * 60)
    print("EXECUTION LAYER - AI-POWERED PRODUCT AUDIT")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("Using: browser-use with Gemini 2.0 Flash")
    print("=" * 60)

    # Verify web app is running first
    import urllib.request
    try:
        urllib.request.urlopen("http://localhost:3000/", timeout=5)
        print("\n✓ Web app is running on localhost:3000")
    except Exception as e:
        print(f"\n✗ Web app not responding: {e}")
        return []

    # Initialize Gemini LLM using browser-use's native support
    print("\nInitializing Gemini LLM...")
    llm = ChatGoogle(
        model="gemini-2.0-flash-exp",
        api_key=os.environ["GOOGLE_API_KEY"],
        temperature=0.1,
    )
    print("LLM initialized successfully")

    # Create browser session with minimal extensions
    print("\nStarting browser...")
    profile = BrowserProfile(
        headless=False,
        disable_security=True,
        extensions=[]  # Disable all extensions to avoid SSL issues
    )
    browser_session = BrowserSession(browser_profile=profile)
    await browser_session.start()
    await asyncio.sleep(2)  # Give browser time to fully initialize
    print("Browser started")

    # Define audit tasks
    audit_tasks = [
        {
            "name": "Homepage Analysis",
            "task": """
            Navigate to http://localhost:3000 and perform a comprehensive UX audit.

            ANALYZE:
            1. Visual design quality (colors, typography, spacing)
            2. Navigation structure and clarity
            3. Empty state handling (if no projects exist)
            4. Call-to-action visibility and clarity
            5. Overall first impression

            Take note of:
            - Page title and branding
            - Any error messages or warnings
            - Loading states
            - Accessibility concerns

            PROVIDE a detailed UX review with specific observations and recommendations.
            """
        },
        {
            "name": "Project Creation Flow",
            "task": """
            Navigate to http://localhost:3000/new and audit the project creation experience.

            ANALYZE:
            1. Form clarity and instructions
            2. File upload interface usability
            3. Required vs optional field clarity
            4. Help text and guidance quality
            5. Button states and feedback

            Look for:
            - Clear labels for all inputs
            - Helpful error prevention
            - Progress indication
            - Back navigation

            PROVIDE specific feedback on the project creation UX.
            """
        },
        {
            "name": "Project Page UX",
            "task": """
            Navigate to http://localhost:3000/p/c6c53f23-5757-47a7-a969-7b86ffbc91b3 and audit the project run page.

            ANALYZE:
            1. Endpoint listing clarity
            2. Form generation for running endpoints
            3. Run history presentation
            4. Share functionality visibility
            5. Overall workflow clarity

            Click on different endpoints and observe:
            - How endpoint details are shown
            - Whether forms appear for input
            - Run button visibility
            - Result display area

            PROVIDE detailed UX feedback on the endpoint running experience.
            """
        },
        {
            "name": "Error Handling Review",
            "task": """
            Navigate to http://localhost:3000/p/nonexistent-project-999 to test error handling.

            ANALYZE:
            1. Error message clarity
            2. Recovery options provided
            3. Visual design of error state
            4. Navigation back to safety

            PROVIDE feedback on how well the app handles errors and guides users to recovery.
            """
        },
    ]

    results = []

    for audit in audit_tasks:
        result = await run_audit_task(browser_session, llm, audit["name"], audit["task"])
        results.append(result)
        await asyncio.sleep(2)

    # Close browser
    await browser_session.stop()

    # Generate AI audit report
    print("\n" + "=" * 60)
    print("AUDIT COMPLETE - GENERATING REPORT")
    print("=" * 60)

    report_path = "/Users/federicodeponte/Downloads/runtime ai/execution-layer/ai-audit-report.md"
    with open(report_path, "w") as f:
        f.write("# Execution Layer - AI-Powered Product Audit\n\n")
        f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write("**Audit Tool:** browser-use with Gemini 2.0 Flash\n\n")
        f.write("---\n\n")

        for r in results:
            f.write(f"## {r['name']}\n\n")
            f.write(f"**Status:** {r['status']}\n\n")
            if r['status'] == 'completed':
                f.write(f"### AI Analysis\n\n{r['result']}\n\n")
            else:
                f.write(f"### Error\n\n{r.get('error', 'Unknown error')}\n\n")
            f.write("---\n\n")

    print(f"\nReport saved to: {report_path}")

    # Print summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for r in results:
        status_icon = "✓" if r["status"] == "completed" else "✗"
        print(f"{status_icon} {r['name']}: {r['status']}")

    return results


if __name__ == "__main__":
    asyncio.run(run_product_audit())
