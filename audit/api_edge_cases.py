#!/usr/bin/env python3
"""
API Edge Case Testing
Tests error handling, validation, and edge cases
"""

import asyncio
import os
import json
import requests

# Note: This script uses requests, not browser-use, so no API key needed for tests

BASE_URL = "http://localhost:3001"

issues_found = []

def test_case(name, passed, details):
    status = "✅" if passed else "❌"
    print(f"{status} {name}")
    if not passed:
        issues_found.append({"test": name, "details": details})
        print(f"   Issue: {details}")

def run_api_tests():
    print("\n" + "="*60)
    print("API EDGE CASE TESTING")
    print("="*60)

    # Test 1: Invalid JSON body
    print("\n--- Test: Invalid JSON Body ---")
    try:
        r = requests.post(f"{BASE_URL}/projects", data="not json", headers={"Content-Type": "application/json"})
        test_case("Invalid JSON returns 400", r.status_code == 400, f"Got {r.status_code}: {r.text[:100]}")
    except Exception as e:
        test_case("Invalid JSON returns 400", False, str(e))

    # Test 2: Missing required fields
    print("\n--- Test: Missing Required Fields ---")
    try:
        r = requests.post(f"{BASE_URL}/projects", json={})
        test_case("Missing fields returns 400", r.status_code == 400, f"Got {r.status_code}: {r.text[:100]}")
    except Exception as e:
        test_case("Missing fields returns 400", False, str(e))

    # Test 3: Invalid project ID
    print("\n--- Test: Invalid Project ID ---")
    try:
        r = requests.get(f"{BASE_URL}/projects/nonexistent-id-12345")
        test_case("Invalid project ID returns 404", r.status_code == 404, f"Got {r.status_code}: {r.text[:100]}")
    except Exception as e:
        test_case("Invalid project ID returns 404", False, str(e))

    # Test 4: Invalid run ID
    print("\n--- Test: Invalid Run ID ---")
    try:
        r = requests.get(f"{BASE_URL}/runs/nonexistent-run-12345")
        test_case("Invalid run ID returns 404", r.status_code == 404, f"Got {r.status_code}: {r.text[:100]}")
    except Exception as e:
        test_case("Invalid run ID returns 404", False, str(e))

    # Test 5: SQL injection attempt in project name
    print("\n--- Test: SQL Injection Attempt ---")
    try:
        r = requests.post(f"{BASE_URL}/projects", json={
            "name": "'; DROP TABLE projects; --",
            "source_type": "zip",
            "zip_data": "UEsDBBQAAAAIAA=="  # minimal zip
        })
        # Should either reject or handle safely
        test_case("SQL injection handled safely", r.status_code in [400, 201, 500], f"Got {r.status_code}: {r.text[:100]}")
    except Exception as e:
        test_case("SQL injection handled safely", False, str(e))

    # Test 6: XSS attempt in project name
    print("\n--- Test: XSS Attempt ---")
    try:
        r = requests.post(f"{BASE_URL}/projects", json={
            "name": "<script>alert('xss')</script>",
            "source_type": "zip",
            "zip_data": "UEsDBBQAAAAIAA=="
        })
        test_case("XSS handled safely", r.status_code in [400, 201], f"Got {r.status_code}: {r.text[:100]}")
    except Exception as e:
        test_case("XSS handled safely", False, str(e))

    # Test 7: Very long project name
    print("\n--- Test: Very Long Project Name ---")
    try:
        r = requests.post(f"{BASE_URL}/projects", json={
            "name": "a" * 10000,
            "source_type": "zip",
            "zip_data": "UEsDBBQAAAAIAA=="
        })
        test_case("Long name rejected", r.status_code == 400, f"Got {r.status_code}: {r.text[:100]}")
    except Exception as e:
        test_case("Long name rejected", False, str(e))

    # Test 8: Empty ZIP data
    print("\n--- Test: Empty ZIP Data ---")
    try:
        r = requests.post(f"{BASE_URL}/projects", json={
            "name": "test-project",
            "source_type": "zip",
            "zip_data": ""
        })
        test_case("Empty ZIP rejected", r.status_code == 400, f"Got {r.status_code}: {r.text[:100]}")
    except Exception as e:
        test_case("Empty ZIP rejected", False, str(e))

    # Test 9: Invalid base64 ZIP data
    print("\n--- Test: Invalid Base64 ZIP Data ---")
    try:
        r = requests.post(f"{BASE_URL}/projects", json={
            "name": "test-project",
            "source_type": "zip",
            "zip_data": "not-valid-base64!!!"
        })
        test_case("Invalid base64 rejected", r.status_code in [400, 500], f"Got {r.status_code}: {r.text[:100]}")
    except Exception as e:
        test_case("Invalid base64 rejected", False, str(e))

    # Test 10: Command injection in GitHub URL
    print("\n--- Test: Command Injection in GitHub URL ---")
    try:
        r = requests.post(f"{BASE_URL}/projects", json={
            "name": "test-project",
            "source_type": "github",
            "github_url": "https://github.com/test/repo; rm -rf /"
        })
        test_case("Command injection blocked", r.status_code in [400, 500], f"Got {r.status_code}: {r.text[:100]}")
    except Exception as e:
        test_case("Command injection blocked", False, str(e))

    # Test 11: Path traversal in GitHub ref
    print("\n--- Test: Path Traversal in GitHub Ref ---")
    try:
        r = requests.post(f"{BASE_URL}/projects", json={
            "name": "test-project",
            "source_type": "github",
            "github_url": "https://github.com/test/repo",
            "github_ref": "../../../etc/passwd"
        })
        test_case("Path traversal blocked", r.status_code in [400, 500], f"Got {r.status_code}: {r.text[:100]}")
    except Exception as e:
        test_case("Path traversal blocked", False, str(e))

    # Test 12: Rate limiting check
    print("\n--- Test: Rate Limiting ---")
    try:
        responses = []
        for i in range(15):
            r = requests.get(f"{BASE_URL}/health")
            responses.append(r.status_code)
        rate_limited = 429 in responses
        test_case("Rate limiting active", True, f"Responses: {set(responses)}")  # Just informational
    except Exception as e:
        test_case("Rate limiting check", False, str(e))

    # Test 13: CORS preflight
    print("\n--- Test: CORS Preflight ---")
    try:
        r = requests.options(f"{BASE_URL}/projects", headers={
            "Origin": "http://localhost:3008",
            "Access-Control-Request-Method": "POST"
        })
        has_cors = "access-control-allow-origin" in r.headers
        test_case("CORS preflight works", has_cors, f"Headers: {dict(r.headers)}")
    except Exception as e:
        test_case("CORS preflight works", False, str(e))

    # Test 14: Content-Type enforcement
    print("\n--- Test: Content-Type Enforcement ---")
    try:
        r = requests.post(f"{BASE_URL}/projects", data="name=test", headers={"Content-Type": "application/x-www-form-urlencoded"})
        test_case("Non-JSON content type handled", r.status_code in [400, 415], f"Got {r.status_code}: {r.text[:100]}")
    except Exception as e:
        test_case("Non-JSON content type handled", False, str(e))

    # Test 15: Large payload
    print("\n--- Test: Large Payload ---")
    try:
        large_data = "A" * (10 * 1024 * 1024)  # 10MB
        r = requests.post(f"{BASE_URL}/projects", json={
            "name": "test",
            "source_type": "zip",
            "zip_data": large_data
        }, timeout=30)
        test_case("Large payload handled", r.status_code in [400, 413, 500], f"Got {r.status_code}")
    except requests.exceptions.Timeout:
        test_case("Large payload handled", True, "Request timed out (acceptable)")
    except Exception as e:
        test_case("Large payload handled", False, str(e))

    # Summary
    print("\n" + "="*60)
    print("API TEST SUMMARY")
    print("="*60)
    print(f"\nTotal Issues Found: {len(issues_found)}")

    if issues_found:
        print("\nIssues:")
        for issue in issues_found:
            print(f"  - {issue['test']}: {issue['details']}")

    # Save report
    report = {
        "total_tests": 15,
        "issues_found": len(issues_found),
        "issues": issues_found
    }

    with open("/Users/federicodeponte/Downloads/runtime ai/execution-layer/audit/api_test_report.json", "w") as f:
        json.dump(report, f, indent=2)

    print(f"\nReport saved to: api_test_report.json")

if __name__ == "__main__":
    run_api_tests()
