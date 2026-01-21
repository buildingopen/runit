#!/usr/bin/env python3
"""Quick verification test"""
import asyncio
import os
import sys

# Load API key from environment (do not hardcode!)
if not os.environ.get("GOOGLE_API_KEY"):
    print("ERROR: GOOGLE_API_KEY environment variable not set")
    print("Set it with: export GOOGLE_API_KEY=your-key-here")
    sys.exit(1)

from browser_use import Agent, ChatGoogle

async def verify():
    llm = ChatGoogle(model='gemini-2.0-flash')

    agent = Agent(
        task="""
        Navigate to http://localhost:3008 and check:
        1. Does the page load correctly?
        2. Look at the bottom of the sidebar - what is the API status? (Should say "API Online" with a green dot)
        3. Are there any error messages?
        Report what you see.
        """,
        llm=llm,
    )

    result = await agent.run(max_steps=5)
    final = result.final_result() if hasattr(result, 'final_result') else str(result)
    print("\n" + "="*60)
    print("VERIFICATION RESULT:")
    print("="*60)
    print(final)
    return final

if __name__ == "__main__":
    asyncio.run(verify())
