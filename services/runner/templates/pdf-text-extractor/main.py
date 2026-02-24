from fastapi import FastAPI, UploadFile, File
import pymupdf

app = FastAPI()


@app.post("/extract")
async def extract_text(file: UploadFile = File(...)):
    """Extract text from an uploaded PDF file."""
    content = await file.read()
    doc = pymupdf.open(stream=content, filetype="pdf")

    pages = []
    for i, page in enumerate(doc):
        pages.append({"page": i + 1, "text": page.get_text()})

    return {
        "filename": file.filename,
        "num_pages": len(doc),
        "pages": pages,
        "full_text": "\n\n".join(p["text"] for p in pages),
    }
