#!/usr/bin/env python3
"""UI/UX Audit - Quick verification of key user flows"""

import asyncio
import os
import sys

# Load API key from environment (do not hardcode!)
if not os.environ.get("GOOGLE_API_KEY"):
    print("ERROR: GOOGLE_API_KEY environment variable not set")
    print("Set it with: export GOOGLE_API_KEY=your-key-here")
    sys.exit(1)

from browser_use import Agent, ChatGoogle

async def run_ui_audit():
    llm = ChatGoogle(model='gemini-2.0-flash')

    agent = Agent(
        task="""
        Navigate to http://localhost:3003 and perform a UI/UX audit:

        1. Check if the page loads correctly
        2. Look at the API status indicator at the bottom of the sidebar - is it showing "API Online" with a green dot?
        3. Check the overall layout - is it clean and usable?
        4. Look for any visual bugs (broken layouts, overlapping elements, missing text)
        5. Check if buttons and interactive elements look clickable
        6. Look for any console errors by checking if there are error indicators

        Report your findings in a structured format:
        - Page Load: [pass/fail]
        - API Status: [what you see]
        - Layout Quality: [assessment]
        - Visual Bugs: [list any found]
        - Interactive Elements: [assessment]
        - Overall Score: [1-10]
        """,
        llm=llm,
    )

    result = await agent.run(max_steps=8)
    final = result.final_result() if hasattr(result, 'final_result') else str(result)

    print("\n" + "="*60)
    print("UI/UX AUDIT RESULT:")
    print("="*60)
    print(final)

    return final

if __name__ == "__main__":
    asyncio.run(run_ui_audit())
