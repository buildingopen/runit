
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Item(BaseModel):
    name: str
    price: float

@app.get("/")
def root():
    return {"message": "Hello World"}

@app.post("/items")
def create_item(item: Item):
    return {"item": item.dict(), "created": True}

@app.get("/error")
def error_endpoint():
    raise ValueError("Test error")

@app.get("/context")
def use_context():
    import os
    import json
    context_dir = Path(os.environ.get("EL_CONTEXT_DIR", "/context"))
    if (context_dir / "company.json").exists():
        return json.loads((context_dir / "company.json").read_text())
    return {"error": "no context"}

@app.get("/artifact")
def create_artifact():
    import os
    from pathlib import Path
    artifacts_dir = Path(os.environ.get("EL_ARTIFACTS_DIR", "/artifacts"))
    (artifacts_dir / "output.txt").write_text("Test artifact")
    return {"artifact_created": True}
