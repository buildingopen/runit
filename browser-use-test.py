#!/usr/bin/env python3
"""
Browser-use UI Test for Execution Layer
Uses Gemini 2.5 Flash (higher quota)
"""

import asyncio
import os
from datetime import datetime

os.environ["GOOGLE_API_KEY"] = "AIzaSyBqWsuG-i3laFKpRTZm5dzcO5_Ry8xMCfs"

from browser_use import Agent, BrowserSession, BrowserProfile
from browser_use.llm.google import ChatGoogle

BASE_URL = "http://localhost:3003"
PROJECT_ID = "6849ec07-654c-44ca-a1e0-7fd9dbb8745f"

async def run_test(name: str, task: str, llm, browser_session) -> dict:
    """Run a single test"""
    print(f"\n{'='*50}")
    print(f"Test: {name}")
    print("="*50)

    try:
        agent = Agent(
            task=task,
            llm=llm,
            browser_session=browser_session,
            use_vision=True,
            max_failures=2,
        )
        result = await agent.run(max_steps=8)

        final = ""
        if result and hasattr(result, 'final_result'):
            fr = result.final_result()
            final = str(fr) if fr else ""

        print(f"✓ {name}: COMPLETED")
        return {"name": name, "status": "pass", "result": final[:500]}
    except Exception as e:
        print(f"✗ {name}: FAILED - {e}")
        return {"name": name, "status": "fail", "error": str(e)}

async def main():
    print("="*60)
    print("BROWSER-USE UI TESTS")
    print(f"Started: {datetime.now()}")
    print(f"Target: {BASE_URL}")
    print("="*60)

    # Use gemini-2.5-flash for higher quota
    llm = ChatGoogle(
        model="gemini-2.5-flash",
        api_key=os.environ["GOOGLE_API_KEY"],
        temperature=0.1,
    )

    # CRITICAL: keep_alive=True prevents CDP session reset between agent runs
    profile = BrowserProfile(headless=False, disable_security=True, keep_alive=True)
    browser = BrowserSession(browser_profile=profile)
    await browser.start()
    await asyncio.sleep(2)

    results = []

    # Test 1: Homepage loads
    results.append(await run_test(
        "Homepage Load",
        f"Navigate to {BASE_URL}. Verify the page loads and shows 'Projects' or 'Execution Layer'. Report what you see on the page.",
        llm, browser
    ))

    await asyncio.sleep(3)  # Rate limit buffer

    # Test 2: Project page loads
    results.append(await run_test(
        "Project Page",
        f"Navigate to {BASE_URL}/p/{PROJECT_ID}. Verify endpoints are displayed. Report how many endpoints you see and their names.",
        llm, browser
    ))

    await asyncio.sleep(3)

    # Test 3: New project page
    results.append(await run_test(
        "New Project Form",
        f"Navigate to {BASE_URL}/new. Verify the project creation form is displayed with file upload. Report what form fields are visible.",
        llm, browser
    ))

    # Use kill() to force cleanup at the end (bypasses keep_alive)
    await browser.kill()

    # Summary
    print("\n" + "="*60)
    print("TEST RESULTS SUMMARY")
    print("="*60)
    passed = sum(1 for r in results if r["status"] == "pass")
    print(f"Passed: {passed}/{len(results)}")
    for r in results:
        icon = "✓" if r["status"] == "pass" else "✗"
        print(f"  {icon} {r['name']}")

    # Save results
    with open("/Users/federicodeponte/Downloads/runtime ai/execution-layer/browser-use-results.txt", "w") as f:
        f.write("Browser-Use UI Test Results\n")
        f.write(f"Generated: {datetime.now()}\n\n")
        for r in results:
            f.write(f"## {r['name']}\n")
            f.write(f"Status: {r['status']}\n")
            if r.get('result'):
                f.write(f"Result: {r['result']}\n")
            if r.get('error'):
                f.write(f"Error: {r['error']}\n")
            f.write("\n")

    return results

if __name__ == "__main__":
    asyncio.run(main())
