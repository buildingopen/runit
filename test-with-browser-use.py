#!/usr/bin/env python3
"""
Test Execution Layer v0 API using browser-use automation
"""

import asyncio
from browser_use import Agent

async def main():
    """Test the API interface using browser automation"""

    agent = Agent(
        task="""
        Go to http://localhost:8080/test-api-browser.html

        Test the Execution Layer v0 API by:
        1. Check if the page loads and shows "API Test Interface"
        2. Click "Check API Health" button
        3. Wait for response and verify it shows {"status":"healthy"}
        4. Click "Get API Information" button
        5. Wait and verify it shows features list
        6. Click "Create New Project" button
        7. Wait and verify it creates a project with project_id
        8. Take a screenshot of the final results

        Report what you see in each test result.
        """,
        llm_config={
            "provider": "anthropic",
            "model": "claude-3-5-sonnet-20241022"
        }
    )

    result = await agent.run()
    print("\n" + "="*60)
    print("BROWSER TEST RESULTS:")
    print("="*60)
    print(result)
    print("="*60)

if __name__ == "__main__":
    asyncio.run(main())
