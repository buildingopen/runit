#!/usr/bin/env python3
"""
Test Production UI using browser-use with Gemini
"""

import asyncio
import os
from browser_use import Agent
from langchain_google_genai import ChatGoogleGenerativeAI

async def main():
    """Test the production UI using browser automation with Gemini"""

    print("\n" + "="*60)
    print("🚀 Starting Browser-Use Test (Google Gemini)")
    print("="*60)

    # Check for API key
    api_key = os.getenv('GOOGLE_API_KEY') or os.getenv('GEMINI_API_KEY')
    if not api_key:
        print("⚠️  No GOOGLE_API_KEY or GEMINI_API_KEY found in environment")
        print("Attempting to continue anyway...")

    # Use Gemini
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.0-flash-exp",
        google_api_key=api_key
    )

    agent = Agent(
        task="""
        Test the Execution Layer production UI at http://localhost:3000

        Please perform these comprehensive tests:

        1. NAVIGATION:
           - Navigate to http://localhost:3000
           - Wait for the page to fully load
           - Confirm the page loaded successfully

        2. HEADER INSPECTION:
           - Verify you can see "Execution Layer" as the main heading
           - Check for "Colab for Apps" subtitle
           - Look for the API status indicator (a colored dot - green/yellow/red)
           - Find the status text ("API Online", "API Offline", or "Checking...")
           - Locate the "Refresh" button

        3. CONTENT AREA:
           - Check the main content area below the header
           - Does it show:
             a) "Your Projects" heading with project cards?
             b) "No projects yet" empty state with an icon?
             c) "Loading projects..." with a spinner?
           - Note any error messages if present

        4. INTERACTION TEST:
           - Click the "Refresh" button
           - Wait 2 seconds
           - Observe if anything changes

        5. VISUAL INSPECTION:
           - Describe the color scheme (backgrounds, text, buttons)
           - Note the layout (centered, full-width, cards, etc.)
           - Assess if the design looks professional and modern
           - Check if there are any visual issues or broken elements

        6. SCREENSHOT:
           - Take a screenshot of the final state

        Please provide a detailed report including:
        - Everything you see on the page
        - The visual design quality
        - Whether the UI looks professional or primitive
        - Any issues or bugs you notice
        - Your overall assessment
        """,
        llm=llm,
        max_actions=25
    )

    try:
        result = await agent.run()

        print("\n" + "="*60)
        print("📊 BROWSER-USE TEST RESULTS (GEMINI):")
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
