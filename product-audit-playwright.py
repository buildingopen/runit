#!/usr/bin/env python3
"""
Product Audit Script using Playwright

This script performs a comprehensive product audit of the Execution Layer web app
by capturing screenshots and page information using Playwright.
"""

import asyncio
import os
from datetime import datetime
from playwright.async_api import async_playwright

async def audit_page(page, name: str, url: str, checks: list[str]) -> dict:
    """Audit a single page"""
    print(f"\n{'='*60}")
    print(f"Auditing: {name}")
    print(f"URL: {url}")
    print("=" * 60)

    result = {
        "name": name,
        "url": url,
        "status": "completed",
        "findings": [],
        "screenshots": [],
        "errors": []
    }

    try:
        # Navigate to page
        response = await page.goto(url, wait_until="networkidle", timeout=30000)

        # Check response status
        if response:
            result["http_status"] = response.status
            if response.status >= 400:
                result["findings"].append(f"⚠️ HTTP Status: {response.status}")

        # Wait for page to settle
        await asyncio.sleep(1)

        # Get page title
        title = await page.title()
        result["title"] = title
        print(f"Page Title: {title}")

        # Take full page screenshot
        screenshot_path = f"/Users/federicodeponte/Downloads/runtime ai/execution-layer/audit-screenshots/{name.lower().replace(' ', '-')}.png"
        os.makedirs(os.path.dirname(screenshot_path), exist_ok=True)
        await page.screenshot(path=screenshot_path, full_page=True)
        result["screenshots"].append(screenshot_path)
        print(f"Screenshot saved: {screenshot_path}")

        # Check for console errors
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        # Perform specific checks
        for check in checks:
            try:
                check_result = await perform_check(page, check)
                result["findings"].append(check_result)
                print(f"  {check_result}")
            except Exception as e:
                result["findings"].append(f"❌ Check failed ({check}): {str(e)}")

        # Check for visible error messages on page
        error_elements = await page.locator("text=error, text=Error, text=failed, text=Failed").all()
        for elem in error_elements[:5]:  # Limit to first 5
            try:
                text = await elem.text_content()
                if text and len(text) < 200:
                    result["findings"].append(f"⚠️ Error text found: {text[:100]}")
            except:
                pass

        # Check for loading states
        loading_elements = await page.locator("text=Loading, text=loading..., [class*='spinner'], [class*='skeleton']").all()
        if loading_elements:
            result["findings"].append(f"⚠️ Found {len(loading_elements)} loading/skeleton elements still visible")

        # Get all headings
        headings = await page.locator("h1, h2, h3").all_text_contents()
        if headings:
            result["findings"].append(f"📝 Headings found: {', '.join(headings[:5])}")

        # Get all buttons
        buttons = await page.locator("button").all_text_contents()
        if buttons:
            visible_buttons = [b.strip() for b in buttons if b.strip()][:10]
            result["findings"].append(f"🔘 Buttons: {', '.join(visible_buttons)}")

        # Get all links
        links = await page.locator("a[href]").evaluate_all("els => els.map(el => ({text: el.textContent?.trim(), href: el.getAttribute('href')}))")
        nav_links = [l for l in links if l.get('href') and not l['href'].startswith('#')][:10]
        if nav_links:
            link_texts = [f"{l.get('text', 'unnamed')} ({l['href']})" for l in nav_links]
            result["findings"].append(f"🔗 Navigation links: {len(nav_links)} found")

        # Check viewport/responsive elements
        viewport = page.viewport_size
        result["findings"].append(f"📐 Viewport: {viewport['width']}x{viewport['height']}")

        # Check for forms
        forms = await page.locator("form").count()
        if forms > 0:
            result["findings"].append(f"📋 Forms found: {forms}")

            # Check form inputs
            inputs = await page.locator("input, textarea, select").all()
            input_types = []
            for inp in inputs[:10]:
                input_type = await inp.get_attribute("type") or "text"
                input_name = await inp.get_attribute("name") or await inp.get_attribute("placeholder") or "unnamed"
                input_types.append(f"{input_name}({input_type})")
            if input_types:
                result["findings"].append(f"  📝 Form fields: {', '.join(input_types)}")

    except Exception as e:
        result["status"] = "error"
        result["errors"].append(str(e))
        print(f"Error: {e}")

    return result


async def perform_check(page, check: str) -> str:
    """Perform a specific check on the page"""

    if check == "has_header":
        header = await page.locator("header").count()
        return "✓ Header present" if header > 0 else "❌ No header found"

    elif check == "has_footer":
        footer = await page.locator("footer").count()
        return "✓ Footer present" if footer > 0 else "⚠️ No footer found"

    elif check == "has_navigation":
        nav = await page.locator("nav, header a, [role='navigation']").count()
        return f"✓ Navigation elements: {nav}" if nav > 0 else "❌ No navigation found"

    elif check == "has_main_heading":
        h1 = await page.locator("h1").count()
        return "✓ Main heading (h1) present" if h1 > 0 else "⚠️ No h1 heading found"

    elif check == "has_cta":
        cta = await page.locator("button, a[href]:not([href='#'])").count()
        return f"✓ Call-to-action elements: {cta}" if cta > 0 else "❌ No CTAs found"

    elif check == "has_file_upload":
        upload = await page.locator("input[type='file'], [class*='upload'], [class*='dropzone']").count()
        return "✓ File upload area present" if upload > 0 else "⚠️ No file upload found"

    elif check == "has_form":
        form = await page.locator("form").count()
        return "✓ Form present" if form > 0 else "⚠️ No form found"

    elif check == "has_error_message":
        error = await page.locator("text=error, text=Error, text=not found, text=404").count()
        return f"⚠️ Error messages visible: {error}" if error > 0 else "✓ No error messages"

    elif check == "has_back_button":
        back = await page.locator("a[href='/'], button:has-text('Back'), a:has-text('Back'), a:has-text('Home')").count()
        return "✓ Back/Home navigation present" if back > 0 else "⚠️ No back navigation found"

    elif check == "is_responsive":
        # Check if page has responsive meta tag
        meta = await page.locator("meta[name='viewport']").count()
        return "✓ Responsive meta tag present" if meta > 0 else "⚠️ Missing viewport meta tag"

    else:
        return f"⚠️ Unknown check: {check}"


async def run_product_audit():
    """Run comprehensive product audit"""

    print("=" * 60)
    print("EXECUTION LAYER - PRODUCT AUDIT (Playwright)")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    base_url = "http://localhost:3000"

    # Define pages to audit
    pages_to_audit = [
        {
            "name": "Homepage",
            "url": f"{base_url}/",
            "checks": ["has_header", "has_navigation", "has_main_heading", "has_cta", "is_responsive"]
        },
        {
            "name": "New Project Page",
            "url": f"{base_url}/new",
            "checks": ["has_header", "has_form", "has_file_upload", "has_back_button", "is_responsive"]
        },
        {
            "name": "Project Page",
            "url": f"{base_url}/p/0006ed52-7f38-4c0a-879c-d7e1bc1c991f",
            "checks": ["has_header", "has_back_button", "is_responsive"]
        },
        {
            "name": "Error Handling (404)",
            "url": f"{base_url}/p/nonexistent-project-12345",
            "checks": ["has_error_message", "has_back_button", "is_responsive"]
        },
    ]

    results = []

    async with async_playwright() as p:
        # Launch browser (visible for debugging)
        browser = await p.chromium.launch(headless=False)

        # Create context with reasonable viewport
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800}
        )

        page = await context.new_page()

        for audit_config in pages_to_audit:
            result = await audit_page(
                page,
                audit_config["name"],
                audit_config["url"],
                audit_config["checks"]
            )
            results.append(result)
            await asyncio.sleep(1)  # Small delay between pages

        # Also test mobile viewport
        print(f"\n{'='*60}")
        print("Testing Mobile Viewport (375x667)")
        print("=" * 60)

        await page.set_viewport_size({"width": 375, "height": 667})
        mobile_result = await audit_page(
            page,
            "Homepage Mobile",
            f"{base_url}/",
            ["has_header", "has_navigation", "is_responsive"]
        )
        results.append(mobile_result)

        await browser.close()

    # Generate report
    print("\n" + "=" * 60)
    print("AUDIT COMPLETE - GENERATING REPORT")
    print("=" * 60)

    report_path = "/Users/federicodeponte/Downloads/runtime ai/execution-layer/audit-report.md"

    with open(report_path, "w") as f:
        f.write("# Execution Layer - Product Audit Report\n\n")
        f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write("---\n\n")

        # Summary
        f.write("## Summary\n\n")
        completed = sum(1 for r in results if r["status"] == "completed")
        f.write(f"- **Pages Audited:** {len(results)}\n")
        f.write(f"- **Successful:** {completed}\n")
        f.write(f"- **Failed:** {len(results) - completed}\n\n")

        # Quick status table
        f.write("| Page | Status | HTTP |\n")
        f.write("|------|--------|------|\n")
        for r in results:
            status_icon = "✅" if r["status"] == "completed" else "❌"
            http_status = r.get("http_status", "N/A")
            f.write(f"| {r['name']} | {status_icon} {r['status']} | {http_status} |\n")
        f.write("\n---\n\n")

        # Detailed findings
        for r in results:
            f.write(f"## {r['name']}\n\n")
            f.write(f"**URL:** {r['url']}\n\n")
            f.write(f"**Status:** {r['status']}\n\n")

            if r.get("title"):
                f.write(f"**Page Title:** {r['title']}\n\n")

            if r.get("http_status"):
                f.write(f"**HTTP Status:** {r['http_status']}\n\n")

            if r["findings"]:
                f.write("### Findings\n\n")
                for finding in r["findings"]:
                    f.write(f"- {finding}\n")
                f.write("\n")

            if r["screenshots"]:
                f.write("### Screenshots\n\n")
                for ss in r["screenshots"]:
                    # Use relative path for markdown
                    rel_path = ss.replace("/Users/federicodeponte/Downloads/runtime ai/execution-layer/", "")
                    f.write(f"![{r['name']}]({rel_path})\n\n")

            if r["errors"]:
                f.write("### Errors\n\n")
                for err in r["errors"]:
                    f.write(f"- ❌ {err}\n")
                f.write("\n")

            f.write("---\n\n")

        # Recommendations section
        f.write("## Recommendations\n\n")
        f.write("Based on the automated audit, here are areas to review:\n\n")

        all_findings = []
        for r in results:
            all_findings.extend(r["findings"])

        warnings = [f for f in all_findings if "⚠️" in f or "❌" in f]
        if warnings:
            f.write("### Issues Found\n\n")
            for w in set(warnings):
                f.write(f"- {w}\n")
            f.write("\n")

        f.write("### Manual Review Recommended\n\n")
        f.write("- Review screenshots in `audit-screenshots/` directory\n")
        f.write("- Test interactive elements manually\n")
        f.write("- Verify form submissions work correctly\n")
        f.write("- Check accessibility (keyboard navigation, screen reader)\n")
        f.write("- Test with different browsers\n")

    print(f"\nReport saved to: {report_path}")
    print(f"Screenshots saved to: audit-screenshots/")

    # Print summary to console
    print("\n" + "=" * 60)
    print("AUDIT SUMMARY")
    print("=" * 60)
    for r in results:
        status_icon = "✓" if r["status"] == "completed" else "✗"
        print(f"{status_icon} {r['name']}: {r['status']}")
        if r["findings"]:
            for f in r["findings"][:5]:
                print(f"    {f}")

    return results


if __name__ == "__main__":
    asyncio.run(run_product_audit())
