"""
Pytest configuration and fixtures for Runner tests
"""

import pytest
import sys
from pathlib import Path


RUNNER_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = RUNNER_ROOT.parent.parent

# Ensure tests can import both `src.*` and sibling packages in a stable way.
for path in (RUNNER_ROOT, RUNNER_ROOT / "src", REPO_ROOT):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)


@pytest.fixture
def sample_fastapi_code():
    """Sample FastAPI app code for testing."""
    return """
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Item(BaseModel):
    name: str
    price: float

@app.post("/items")
async def create_item(item: Item):
    return {"item": item.dict(), "created": True}

@app.get("/health")
async def health():
    return {"status": "ok"}
"""


@pytest.fixture
def sample_requirements():
    """Sample requirements.txt for testing."""
    return """
fastapi==0.109.0
pydantic==2.5.0
"""


@pytest.fixture
def temp_project_dir(tmp_path):
    """Create temporary project directory with structure."""
    project_dir = tmp_path / "test_project"
    project_dir.mkdir()

    # Create main.py
    (project_dir / "main.py").write_text("""
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello World"}
""")

    # Create requirements.txt
    (project_dir / "requirements.txt").write_text("fastapi>=0.109.0\\n")

    return project_dir


@pytest.fixture
def mock_openapi_spec():
    """Mock OpenAPI spec for testing."""
    return {
        "openapi": "3.0.0",
        "info": {"title": "Test API", "version": "1.0.0"},
        "paths": {
            "/items": {
                "post": {
                    "summary": "Create item",
                    "requestBody": {
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "name": {"type": "string"},
                                        "price": {"type": "number"}
                                    },
                                    "required": ["name", "price"]
                                }
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "Success",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }


# Skip tests that require Modal credentials if not available
def pytest_configure(config):
    config.addinivalue_line(
        "markers", "requires_modal: mark test as requiring Modal credentials"
    )


def pytest_collection_modifyitems(config, items):
    import os
    skip_modal = pytest.mark.skip(reason="Modal credentials not available")

    for item in items:
        if "requires_modal" in item.keywords:
            if not os.getenv("MODAL_TOKEN_ID"):
                item.add_marker(skip_modal)
