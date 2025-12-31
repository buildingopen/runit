#!/usr/bin/env python3
"""
Test Production UI using browser-use with local LLM
"""

import asyncio
from browser_use import Agent
from langchain_ollama import ChatOllama

async def main():
    """Test the production UI using local browser automation"""

    print("\n" + "="*60)
    print("🚀 Starting Browser-Use Test (Local LLM)")
    print("="*60)

    # Use local Ollama model
    llm = ChatOllama(
        model="llama3.2:latest",  # or whatever model you have installed
        base_url="http://localhost:11434"
    )

    agent = Agent(
        task="""
        Test the Execution Layer production UI at http://localhost:3000

        Please perform these tests:
        1. Navigate to http://localhost:3000
        2. Wait for the page to fully load
        3. Verify you can see "Execution Layer" as the main heading
        4. Check if there's an API status indicator (a colored dot)
        5. Look for the status text (should say "API Online", "API Offline", or "Checking...")
        6. Check if there's a "Refresh" button
        7. Check the main content area - does it show:
           - "Your Projects" with project cards, OR
           - "No projects yet" empty state, OR
           - "Loading projects..." spinner
        8. Try clicking the "Refresh" button
        9. Take a screenshot of the final state

        Report everything you see including:
        - Page title and headings
        - Colors and styling
        - Any buttons or interactive elements
        - The overall layout and design
        - Whether the UI looks professional or primitive
        """,
        llm=llm,
        max_actions=20
    )

    try:
        result = await agent.run()

        print("\n" + "="*60)
        print("📊 BROWSER-USE TEST RESULTS:")
        print("="*60)
        print(result)
        print("="*60)
        print("\n✅ Test completed successfully!")

    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
