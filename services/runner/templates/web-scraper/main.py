import requests
from fastapi import FastAPI
from pydantic import BaseModel
from bs4 import BeautifulSoup

app = FastAPI()


class ScrapeRequest(BaseModel):
    url: str


@app.post("/scrape")
async def scrape(request: ScrapeRequest):
    """Scrape a web page and extract title, text, and links."""
    response = requests.get(request.url, timeout=15, headers={
        "User-Agent": "RuntimeAI-Scraper/1.0"
    })
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # Remove script and style elements
    for tag in soup(["script", "style"]):
        tag.decompose()

    title = soup.title.string.strip() if soup.title and soup.title.string else ""
    text = soup.get_text(separator="\n", strip=True)
    links = [
        {"text": a.get_text(strip=True), "href": a.get("href", "")}
        for a in soup.find_all("a", href=True)
        if a.get("href", "").startswith("http")
    ][:50]  # Limit to 50 links

    return {
        "url": request.url,
        "title": title,
        "text": text[:5000],  # Limit text length
        "links": links,
    }
