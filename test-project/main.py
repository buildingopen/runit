from fastapi import FastAPI

app = FastAPI(title="Test API", version="1.0.0")

@app.get("/")
def read_root():
    """Root endpoint that returns a greeting"""
    return {"message": "Hello from Test API"}

@app.get("/items/{item_id}")
def read_item(item_id: int, q: str = None):
    """Get an item by ID with optional query parameter"""
    return {"item_id": item_id, "query": q}

@app.post("/calculate")
def calculate(a: int, b: int):
    """Calculate sum of two numbers"""
    return {"result": a + b, "operation": "add"}
