#!/usr/bin/env python3
"""
Product Audit Script using browser-use with Gemini
Tests key user flows and generates an audit report
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

# Audit results storage
audit_results = []

def log_result(test_name: str, status: str, details: str):
    """Log audit result"""
    result = {
        "test": test_name,
        "status": status,
        "details": details,
        "timestamp": datetime.now().isoformat()
    }
    audit_results.append(result)
    print(f"[{status}] {test_name}: {details[:200]}")

async def run_audit():
    """Run the product audit using browser-use"""

    # Initialize Gemini model
    llm = ChatGoogle(model='gemini-2.0-flash')

    # Test 1: Health Check API
    print("\n" + "="*60)
    print("AUDIT TEST 1: Control Plane Health Check")
    print("="*60)

    agent = Agent(
        task="""
        Navigate to http://localhost:3001/health and verify:
        1. The page loads successfully
        2. Check if there's a JSON response with status information
        3. Report what you see on the page
        """,
        llm=llm,
    )

    try:
        result = await agent.run(max_steps=5)
        final_result = result.final_result() if hasattr(result, 'final_result') else str(result)
        log_result("Health Check API", "PASS" if final_result else "FAIL", str(final_result))
    except Exception as e:
        log_result("Health Check API", "ERROR", str(e))

    # Test 2: Main API Info
    print("\n" + "="*60)
    print("AUDIT TEST 2: API Root Endpoint")
    print("="*60)

    agent = Agent(
        task="""
        Navigate to http://localhost:3001/ and verify:
        1. The API returns information about the service
        2. Check for version, name, and features
        3. Report the API information you find
        """,
        llm=llm,
    )

    try:
        result = await agent.run(max_steps=5)
        final_result = result.final_result() if hasattr(result, 'final_result') else str(result)
        log_result("API Root Endpoint", "PASS" if final_result else "FAIL", str(final_result))
    except Exception as e:
        log_result("API Root Endpoint", "ERROR", str(e))

    # Test 3: Web UI Homepage
    print("\n" + "="*60)
    print("AUDIT TEST 3: Web UI Homepage")
    print("="*60)

    agent = Agent(
        task="""
        Navigate to http://localhost:3000 and verify:
        1. The page loads with a proper UI
        2. Look for project-related elements (projects list, create button, etc.)
        3. Check for any error messages
        4. Report the main UI elements you see
        """,
        llm=llm,
    )

    try:
        result = await agent.run(max_steps=10)
        final_result = result.final_result() if hasattr(result, 'final_result') else str(result)
        log_result("Web UI Homepage", "PASS" if final_result else "FAIL", str(final_result))
    except Exception as e:
        log_result("Web UI Homepage", "ERROR", str(e))

    # Test 4: Projects API
    print("\n" + "="*60)
    print("AUDIT TEST 4: Projects API Endpoint")
    print("="*60)

    agent = Agent(
        task="""
        Navigate to http://localhost:3001/projects and verify:
        1. The endpoint returns a JSON response
        2. Check if it lists any projects or returns an empty array
        3. Look for proper JSON structure with 'projects' key
        4. Report what you find
        """,
        llm=llm,
    )

    try:
        result = await agent.run(max_steps=5)
        final_result = result.final_result() if hasattr(result, 'final_result') else str(result)
        log_result("Projects API", "PASS" if final_result else "FAIL", str(final_result))
    except Exception as e:
        log_result("Projects API", "ERROR", str(e))

    # Test 5: OpenAPI Documentation
    print("\n" + "="*60)
    print("AUDIT TEST 5: OpenAPI Documentation")
    print("="*60)

    agent = Agent(
        task="""
        Navigate to http://localhost:3001/openapi.json and verify:
        1. The OpenAPI spec loads as JSON
        2. Check for paths, info, and components sections
        3. Report the available API endpoints you find
        """,
        llm=llm,
    )

    try:
        result = await agent.run(max_steps=5)
        final_result = result.final_result() if hasattr(result, 'final_result') else str(result)
        log_result("OpenAPI Documentation", "PASS" if final_result else "FAIL", str(final_result))
    except Exception as e:
        log_result("OpenAPI Documentation", "ERROR", str(e))

    # Generate Report
    print("\n" + "="*60)
    print("AUDIT REPORT SUMMARY")
    print("="*60)

    passed = sum(1 for r in audit_results if r["status"] == "PASS")
    failed = sum(1 for r in audit_results if r["status"] == "FAIL")
    errors = sum(1 for r in audit_results if r["status"] == "ERROR")

    print(f"\nTotal Tests: {len(audit_results)}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Errors: {errors}")

    print("\nDetailed Results:")
    for r in audit_results:
        print(f"\n  [{r['status']}] {r['test']}")
        print(f"    Details: {r['details'][:200]}...")

    # Save report to file
    report_path = "/Users/federicodeponte/Downloads/runtime ai/execution-layer/audit/audit_report.txt"
    with open(report_path, "w") as f:
        f.write(f"Product Audit Report\n")
        f.write(f"Generated: {datetime.now().isoformat()}\n")
        f.write("="*60 + "\n\n")
        f.write(f"Total Tests: {len(audit_results)}\n")
        f.write(f"Passed: {passed}\n")
        f.write(f"Failed: {failed}\n")
        f.write(f"Errors: {errors}\n\n")
        for r in audit_results:
            f.write(f"[{r['status']}] {r['test']}\n")
            f.write(f"  Time: {r['timestamp']}\n")
            f.write(f"  Details: {r['details']}\n\n")

    print(f"\nReport saved to: {report_path}")
    return audit_results

if __name__ == "__main__":
    asyncio.run(run_audit())
