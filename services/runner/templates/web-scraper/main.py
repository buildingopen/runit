import ipaddress
import socket
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()


class ScrapeRequest(BaseModel):
    url: str


def validate_public_url(raw_url: str) -> str:
    parsed = urlparse(raw_url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Use a valid http or https URL")

    host = parsed.hostname.lower()
    if host == "localhost":
        raise HTTPException(status_code=400, detail="Localhost URLs are not allowed")

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
        raise HTTPException(status_code=400, detail="Could not resolve host") from exc

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
                status_code=400,
                detail="Private, local, and metadata network targets are not allowed",
            )

    return raw_url


@app.post("/scrape")
async def scrape(request: ScrapeRequest):
    """Scrape a web page and extract title, text, and links."""
    response = requests.get(
        validate_public_url(request.url),
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
        "url": request.url,
        "title": title,
        "text": text[:5000],  # Limit text length
        "links": links,
    }
