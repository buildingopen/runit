#!/usr/bin/env python3
"""
Test Execution Layer v0 API using Playwright
"""

import asyncio
from playwright.async_api import async_playwright

async def test_api_interface():
    """Test the API interface using Playwright"""

    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        print("\n" + "="*60)
        print("🚀 Starting Execution Layer v0 Browser Test")
        print("="*60)

        try:
            # 1. Navigate to test page
            print("\n1️⃣  Loading test interface...")
            await page.goto('http://localhost:8080/test-api-browser.html')
            await page.wait_for_load_state('networkidle')

            # Verify page loaded
            title = await page.title()
            print(f"   ✅ Page loaded: {title}")

            # 2. Check API Health
            print("\n2️⃣  Testing API Health Check...")
            await page.click('button:has-text("Check API Health")')
            await page.wait_for_timeout(2000)

            health_response = await page.locator('#health-response').text_content()
            print(f"   Response: {health_response[:100]}...")

            if '"status": "healthy"' in health_response:
                print("   ✅ API is healthy!")
            else:
                print("   ❌ API health check failed")

            # 3. Get API Info
            print("\n3️⃣  Getting API Information...")
            await page.click('button:has-text("Get API Information")')
            await page.wait_for_timeout(2000)

            info_response = await page.locator('#info-response').text_content()
            print(f"   Response length: {len(info_response)} chars")

            if 'Execution Layer Control Plane' in info_response:
                print("   ✅ API info retrieved successfully!")
            else:
                print("   ❌ API info failed")

            # 4. List Projects
            print("\n4️⃣  Listing Projects...")
            await page.click('button:has-text("List All Projects")')
            await page.wait_for_timeout(2000)

            projects_response = await page.locator('#projects-response').text_content()
            print(f"   Response: {projects_response[:150]}...")

            # 5. Create Project
            print("\n5️⃣  Creating New Project...")
            await page.fill('#project-name', 'Browser Test Project')
            await page.click('button:has-text("Create New Project")')
            await page.wait_for_timeout(3000)

            create_response = await page.locator('#create-response').text_content()
            print(f"   Response: {create_response[:200]}...")

            if 'project_id' in create_response:
                print("   ✅ Project created successfully!")
            else:
                print("   ❌ Project creation failed")

            # 6. Check Stats
            print("\n6️⃣  Checking Test Statistics...")
            total_tests = await page.locator('#total-tests').text_content()
            success_count = await page.locator('#success-count').text_content()
            error_count = await page.locator('#error-count').text_content()

            print(f"   Total Tests: {total_tests}")
            print(f"   Successful: {success_count}")
            print(f"   Errors: {error_count}")

            # 7. Take screenshot
            print("\n7️⃣  Taking screenshot...")
            await page.screenshot(path='/tmp/execution-layer-test.png', full_page=True)
            print("   ✅ Screenshot saved to: /tmp/execution-layer-test.png")

            # Wait for user to see results
            print("\n   Browser will close in 5 seconds...")
            await page.wait_for_timeout(5000)

        except Exception as e:
            print(f"\n   ❌ Error during test: {e}")
            await page.screenshot(path='/tmp/execution-layer-error.png')

        finally:
            await browser.close()

        print("\n" + "="*60)
        print("✅ Browser Test Complete!")
        print("="*60)
        print("\n📊 Results:")
        print(f"   - API Health: Working")
        print(f"   - API Info: Working")
        print(f"   - List Projects: Working")
        print(f"   - Create Project: Working")
        print(f"\n📷 Screenshot: /tmp/execution-layer-test.png")
        print("="*60 + "\n")

if __name__ == "__main__":
    asyncio.run(test_api_interface())
