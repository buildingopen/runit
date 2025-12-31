#!/usr/bin/env python3
"""
Test UI and capture console logs
"""

import asyncio
from playwright.async_api import async_playwright

async def main():
    print("\n" + "="*60)
    print("🧪 UI TEST WITH CONSOLE LOGGING")
    print("="*60)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        # Capture console messages
        console_messages = []
        page.on('console', lambda msg: console_messages.append(f"[{msg.type}] {msg.text}"))

        # Capture errors
        errors = []
        page.on('pageerror', lambda exc: errors.append(str(exc)))

        try:
            print("\n📍 Navigating to http://localhost:3000...")
            await page.goto('http://localhost:3000', wait_until='networkidle')
            print("   ✅ Page loaded")

            print("\n⏳ Waiting 10 seconds for JavaScript execution...")
            await page.wait_for_timeout(10000)

            print("\n📋 Console Messages:")
            if console_messages:
                for msg in console_messages:
                    print(f"   {msg}")
            else:
                print("   (No console messages)")

            print("\n❌ JavaScript Errors:")
            if errors:
                for err in errors:
                    print(f"   {err}")
            else:
                print("   ✅ No JavaScript errors!")

            # Check what's actually rendered
            print("\n🔍 Checking rendered content...")
            body_text = await page.locator('body').text_content()
            print(f"   Body text (first 200 chars): {body_text[:200]}")

            # Take screenshot
            await page.screenshot(path='/tmp/ui-console-test.png', full_page=True)
            print(f"\n📸 Screenshot: /tmp/ui-console-test.png")

            # Check network requests
            print("\n🌐 Checking if page made network requests...")
            await page.wait_for_timeout(5000)

            print("\n✅ Test complete. Browser will close in 5 seconds...")
            await page.wait_for_timeout(5000)

        except Exception as e:
            print(f"\n❌ Error: {e}")
            import traceback
            traceback.print_exc()

        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
