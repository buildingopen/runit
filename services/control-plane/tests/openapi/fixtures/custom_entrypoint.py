"""
Custom Entrypoint - Test Fixture

ABOUTME: FastAPI app with non-standard variable name
"""

from fastapi import FastAPI
from pydantic import BaseModel

# Non-standard variable name
application = FastAPI(title="Custom Entrypoint App")


class Item(BaseModel):
    name: str
    price: float


@application.get("/")
async def root():
    return {"message": "Custom entrypoint"}


@application.post("/items")
async def create_item(item: Item):
    return item
