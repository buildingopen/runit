import ipaddress
import os
import socket
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()


class ScrapeRequest(BaseModel):
    path: str = "/"


def get_base_url() -> str:
    raw_url = os.getenv("SCRAPER_BASE_URL", "https://example.com")
    parsed = urlparse(raw_url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=500, detail="SCRAPER_BASE_URL must be a valid http or https URL")

    host = parsed.hostname.lower()
    if host == "localhost":
        raise HTTPException(status_code=500, detail="SCRAPER_BASE_URL cannot target localhost")

    try:
        addresses = {
            result[4][0]
            for result in socket.getaddrinfo(
                host,
                parsed.port or (443 if parsed.scheme == "https" else 80),
                type=socket.SOCK_STREAM,
            )
        }
    except socket.gaierror as exc:
        raise HTTPException(status_code=500, detail="Could not resolve SCRAPER_BASE_URL") from exc

    for address in addresses:
        ip = ipaddress.ip_address(address)
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            raise HTTPException(
                status_code=500,
                detail="SCRAPER_BASE_URL cannot target private, local, or metadata networks",
            )

    return f"{parsed.scheme}://{parsed.netloc}"


def normalize_path(path: str) -> str:
    cleaned = path.strip() or "/"
    if not cleaned.startswith("/"):
        raise HTTPException(status_code=400, detail="Path must start with /")
    return cleaned


@app.post("/scrape")
async def scrape(request: ScrapeRequest):
    """Scrape a page from the configured public site and extract title, text, and links."""
    target_url = get_base_url().rstrip("/") + normalize_path(request.path)
    response = requests.get(
        target_url,
        timeout=15,
        headers={"User-Agent": "RuntimeAI-Scraper/1.0"},
    )
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
    ][
        :50
    ]  # Limit to 50 links

    return {
        "url": target_url,
        "title": title,
        "text": text[:5000],  # Limit text length
        "links": links,
    }
