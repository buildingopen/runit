import os
from fastapi import FastAPI
from pydantic import BaseModel
from google import genai

app = FastAPI()

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", ""))


class ChatRequest(BaseModel):
    message: str


@app.post("/chat")
async def chat(request: ChatRequest):
    """Send a message and get an AI response."""
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=request.message,
    )
    return {
        "message": request.message,
        "response": response.text,
    }
