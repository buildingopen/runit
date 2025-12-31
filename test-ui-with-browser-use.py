#!/usr/bin/env python3
"""
Test Production UI using browser-use automation
"""

import asyncio
import os
from browser_use import Agent

async def main():
    """Test the production UI using browser automation"""

    # Set up the API key from environment
    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        print("❌ ANTHROPIC_API_KEY not set in environment")
        return

    agent = Agent(
        task="""
        Test the Execution Layer production UI at http://localhost:3000

        Please:
        1. Navigate to http://localhost:3000
        2. Verify the page loads and shows "Execution Layer" as the title
        3. Check if the API status indicator is visible (should be a colored dot)
        4. Look for either "API Online", "API Offline", or "Checking..." status
        5. Check if the page shows either:
           - "Your Projects" section with project cards
           - "No projects yet" empty state
        6. Click the "Refresh" button to test interactivity
        7. Take a screenshot of the final state
        8. Report what you see in detail

        Important: Describe the visual appearance, colors, layout, and any UI elements you observe.
        """,
        llm_config={
            "provider": "anthropic",
            "model": "claude-3-5-sonnet-20241022",
            "api_key": api_key
        }
    )

    print("\n" + "="*60)
    print("🚀 Starting Browser-Use Test of Production UI")
    print("="*60)

    result = await agent.run()

    print("\n" + "="*60)
    print("📊 BROWSER-USE TEST RESULTS:")
    print("="*60)
    print(result)
    print("="*60)

if __name__ == "__main__":
    asyncio.run(main())
