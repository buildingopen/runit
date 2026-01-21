#!/usr/bin/env python3
"""
Full User Flow Test using browser-use with Gemini
Tests complete user journeys through the Execution Layer platform
"""

import asyncio
import os
import sys
from datetime import datetime

# Load API key from environment (do not hardcode!)
if not os.environ.get("GOOGLE_API_KEY"):
    print("ERROR: GOOGLE_API_KEY environment variable not set")
    print("Set it with: export GOOGLE_API_KEY=your-key-here")
    print("Or create a .env file in this directory")
    sys.exit(1)

from browser_use import Agent, ChatGoogle

# Test results storage
test_results = []

def log_result(test_name: str, status: str, details: str):
    """Log test result"""
    result = {
        "test": test_name,
        "status": status,
        "details": details,
        "timestamp": datetime.now().isoformat()
    }
    test_results.append(result)
    status_icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"{status_icon} [{status}] {test_name}")
    print(f"   {details[:150]}...")

async def run_user_flow_tests():
    """Run comprehensive user flow tests"""

    # Initialize Gemini model
    llm = ChatGoogle(model='gemini-2.0-flash')

    print("\n" + "="*70)
    print("FULL USER FLOW TEST SUITE")
    print("="*70)

    # Flow 1: Homepage and Navigation
    print("\n" + "-"*70)
    print("FLOW 1: Homepage Navigation")
    print("-"*70)

    agent = Agent(
        task="""
        Navigate to http://localhost:3008 (the web UI) and verify:
        1. The page loads with the Execution Layer UI
        2. Look for a sidebar with "Projects" navigation
        3. Look for a "New Project" button
        4. Check if there's a projects list (may be empty)
        5. Report all UI elements you find and their state
        """,
        llm=llm,
    )

    try:
        result = await agent.run(max_steps=8)
        final = result.final_result() if hasattr(result, 'final_result') else str(result)
        status = "PASS" if final and "error" not in str(final).lower() else "FAIL"
        log_result("Homepage Navigation", status, str(final))
    except Exception as e:
        log_result("Homepage Navigation", "ERROR", str(e))

    # Flow 2: New Project Page
    print("\n" + "-"*70)
    print("FLOW 2: New Project Page")
    print("-"*70)

    agent = Agent(
        task="""
        Navigate to http://localhost:3008/new and verify:
        1. The "New Project" page loads
        2. Look for a form with project name input
        3. Look for upload options (ZIP upload or GitHub import)
        4. Check if there's a submit/create button
        5. Report all form fields and buttons you find
        """,
        llm=llm,
    )

    try:
        result = await agent.run(max_steps=8)
        final = result.final_result() if hasattr(result, 'final_result') else str(result)
        status = "PASS" if final else "FAIL"
        log_result("New Project Page", status, str(final))
    except Exception as e:
        log_result("New Project Page", "ERROR", str(e))

    # Flow 3: API - Create Project (simulated via API check)
    print("\n" + "-"*70)
    print("FLOW 3: Projects API")
    print("-"*70)

    agent = Agent(
        task="""
        Navigate to http://localhost:3001/projects and verify:
        1. The API returns a JSON response
        2. Check the structure: should have 'projects' array and 'total' count
        3. Report the current number of projects
        4. Then navigate to http://localhost:3001/openapi.json
        5. Verify it shows available API endpoints
        6. Report the main endpoints you find in the OpenAPI spec
        """,
        llm=llm,
    )

    try:
        result = await agent.run(max_steps=10)
        final = result.final_result() if hasattr(result, 'final_result') else str(result)
        status = "PASS" if final and "projects" in str(final).lower() else "FAIL"
        log_result("Projects API", status, str(final))
    except Exception as e:
        log_result("Projects API", "ERROR", str(e))

    # Flow 4: API Documentation
    print("\n" + "-"*70)
    print("FLOW 4: API Documentation Check")
    print("-"*70)

    agent = Agent(
        task="""
        Navigate to http://localhost:3001/openapi.json and:
        1. Verify it's a valid OpenAPI 3.0 specification
        2. List all the API paths/endpoints you find
        3. Check if there are endpoints for: projects, runs, health
        4. Report the API title and version
        """,
        llm=llm,
    )

    try:
        result = await agent.run(max_steps=6)
        final = result.final_result() if hasattr(result, 'final_result') else str(result)
        status = "PASS" if final and "openapi" in str(final).lower() else "FAIL"
        log_result("API Documentation", status, str(final))
    except Exception as e:
        log_result("API Documentation", "ERROR", str(e))

    # Flow 5: Full API Health Check
    print("\n" + "-"*70)
    print("FLOW 5: System Health Verification")
    print("-"*70)

    agent = Agent(
        task="""
        Perform a system health check by visiting these endpoints in order:
        1. http://localhost:3001/health - verify status is healthy
        2. http://localhost:3001/ - verify API info with name, version, status
        3. http://localhost:3001/projects - verify projects endpoint works

        Report the status of each endpoint and whether the system is fully operational.
        """,
        llm=llm,
    )

    try:
        result = await agent.run(max_steps=10)
        final = result.final_result() if hasattr(result, 'final_result') else str(result)
        status = "PASS" if final and "healthy" in str(final).lower() else "FAIL"
        log_result("System Health", status, str(final))
    except Exception as e:
        log_result("System Health", "ERROR", str(e))

    # Flow 6: UI Responsiveness
    print("\n" + "-"*70)
    print("FLOW 6: UI Navigation Flow")
    print("-"*70)

    agent = Agent(
        task="""
        Test the UI navigation flow:
        1. Go to http://localhost:3008
        2. Click on the "New Project" button in the sidebar
        3. Verify you're on the new project page
        4. Look for navigation back to projects
        5. Report the navigation experience and any issues found
        """,
        llm=llm,
    )

    try:
        result = await agent.run(max_steps=12)
        final = result.final_result() if hasattr(result, 'final_result') else str(result)
        status = "PASS" if final else "FAIL"
        log_result("UI Navigation", status, str(final))
    except Exception as e:
        log_result("UI Navigation", "ERROR", str(e))

    # Generate Summary Report
    print("\n" + "="*70)
    print("USER FLOW TEST SUMMARY")
    print("="*70)

    passed = sum(1 for r in test_results if r["status"] == "PASS")
    failed = sum(1 for r in test_results if r["status"] == "FAIL")
    errors = sum(1 for r in test_results if r["status"] == "ERROR")
    total = len(test_results)

    print(f"\nTotal Tests: {total}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"⚠️  Errors: {errors}")
    print(f"\nSuccess Rate: {(passed/total)*100:.1f}%")

    print("\n" + "-"*70)
    print("DETAILED RESULTS")
    print("-"*70)

    for r in test_results:
        icon = "✅" if r["status"] == "PASS" else "❌" if r["status"] == "FAIL" else "⚠️"
        print(f"\n{icon} {r['test']}")
        print(f"   Status: {r['status']}")
        print(f"   Time: {r['timestamp']}")
        # Truncate details for readability
        details = r['details'][:300] + "..." if len(r['details']) > 300 else r['details']
        print(f"   Details: {details}")

    # Save report
    report_path = "/Users/federicodeponte/Downloads/runtime ai/execution-layer/audit/user_flow_report.txt"
    with open(report_path, "w") as f:
        f.write("Full User Flow Test Report\n")
        f.write(f"Generated: {datetime.now().isoformat()}\n")
        f.write("="*70 + "\n\n")
        f.write(f"Total Tests: {total}\n")
        f.write(f"Passed: {passed}\n")
        f.write(f"Failed: {failed}\n")
        f.write(f"Errors: {errors}\n")
        f.write(f"Success Rate: {(passed/total)*100:.1f}%\n\n")
        f.write("-"*70 + "\n")
        f.write("DETAILED RESULTS\n")
        f.write("-"*70 + "\n\n")
        for r in test_results:
            f.write(f"[{r['status']}] {r['test']}\n")
            f.write(f"  Time: {r['timestamp']}\n")
            f.write(f"  Details: {r['details']}\n\n")

    print(f"\n📄 Report saved to: {report_path}")
    return test_results

if __name__ == "__main__":
    asyncio.run(run_user_flow_tests())
