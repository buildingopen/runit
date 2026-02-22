"""
Image Analysis - File upload sample app for Runtime.

Demonstrates:
- File upload handling
- Image processing
- Thumbnail generation
- Multiple artifact outputs
"""

import io
import sys
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, ImageFilter, ImageStat
from pydantic import BaseModel, Field

# Add SDK to path (for local development)
sdk_path = Path(__file__).parent.parent.parent / "sdk"
if sdk_path.exists():
    sys.path.insert(0, str(sdk_path))

from execution_layer import save_artifact, save_json  # noqa: E402

app = FastAPI(
    title="Image Analysis", description="Analyze and process uploaded images", version="1.0.0"
)


class ImageInfo(BaseModel):
    """Image analysis results."""

    filename: str = Field(..., description="Original filename")
    format: str = Field(..., description="Image format (JPEG, PNG, etc.)")
    mode: str = Field(..., description="Color mode (RGB, RGBA, L, etc.)")
    width: int = Field(..., description="Image width in pixels")
    height: int = Field(..., description="Image height in pixels")
    size_bytes: int = Field(..., description="File size in bytes")
    aspect_ratio: float = Field(..., description="Width / height ratio")
    is_grayscale: bool = Field(..., description="Whether image is grayscale")
    average_brightness: float = Field(..., description="Average brightness (0-255)")
    dominant_color: str | None = Field(None, description="Dominant color (hex)")


@app.post("/analyze_image", response_model=ImageInfo)
async def analyze_image(
    file: UploadFile = File(..., description="Image file to analyze"),
) -> ImageInfo:
    """
    Analyze uploaded image and generate thumbnails.

    This endpoint:
    1. Reads the uploaded image
    2. Analyzes image properties
    3. Generates thumbnail variants
    4. Saves processed images as artifacts
    """

    # Read image data
    image_data = await file.read()

    if not image_data:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    try:
        # Open image with PIL
        image = Image.open(io.BytesIO(image_data))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")

    # Analyze image
    width, height = image.size
    aspect_ratio = width / height if height > 0 else 0

    # Check if grayscale
    is_grayscale = image.mode in ("L", "1") or (
        image.mode == "RGB" and len(set(image.getdata()[0] if image.getdata() else (0, 0, 0))) == 1
    )

    # Calculate average brightness
    if image.mode != "L":
        grayscale = image.convert("L")
    else:
        grayscale = image

    stat = ImageStat.Stat(grayscale)
    avg_brightness = stat.mean[0]

    # Get dominant color (simplified - just get average color)
    if image.mode == "RGB" or image.mode == "RGBA":
        # Resize to 1x1 to get average color
        tiny = image.resize((1, 1), Image.Resampling.LANCZOS)
        dominant_rgb = tiny.getpixel((0, 0))
        if isinstance(dominant_rgb, int):
            dominant_color = f"#{dominant_rgb:02x}{dominant_rgb:02x}{dominant_rgb:02x}"
        else:
            r, g, b = dominant_rgb[:3]
            dominant_color = f"#{r:02x}{g:02x}{b:02x}"
    else:
        dominant_color = None

    # Save original image
    save_artifact(f"original_{file.filename}", image_data)

    # Generate and save thumbnail (200x200)
    thumbnail = image.copy()
    thumbnail.thumbnail((200, 200), Image.Resampling.LANCZOS)
    thumb_bytes = io.BytesIO()
    thumbnail.save(thumb_bytes, format=image.format or "PNG")
    save_artifact("thumbnail_200.png", thumb_bytes.getvalue())

    # Generate medium thumbnail (800x800)
    medium = image.copy()
    medium.thumbnail((800, 800), Image.Resampling.LANCZOS)
    medium_bytes = io.BytesIO()
    medium.save(medium_bytes, format=image.format or "PNG")
    save_artifact("thumbnail_800.png", medium_bytes.getvalue())

    # Apply some filters and save
    if image.mode in ("RGB", "L"):
        # Blur
        blurred = image.filter(ImageFilter.GaussianBlur(radius=5))
        blur_bytes = io.BytesIO()
        blurred.save(blur_bytes, format=image.format or "PNG")
        save_artifact("blurred.png", blur_bytes.getvalue())

        # Sharpen
        sharpened = image.filter(ImageFilter.SHARPEN)
        sharp_bytes = io.BytesIO()
        sharpened.save(sharp_bytes, format=image.format or "PNG")
        save_artifact("sharpened.png", sharp_bytes.getvalue())

    # Save analysis results as JSON
    analysis = {
        "filename": file.filename,
        "format": image.format or "UNKNOWN",
        "mode": image.mode,
        "width": width,
        "height": height,
        "size_bytes": len(image_data),
        "aspect_ratio": round(aspect_ratio, 2),
        "is_grayscale": is_grayscale,
        "average_brightness": round(avg_brightness, 2),
        "dominant_color": dominant_color,
    }
    save_json("analysis.json", analysis)

    return ImageInfo(**analysis)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "service": "Image Analysis",
        "status": "ready",
        "version": "1.0.0",
        "supported_formats": ["JPEG", "PNG", "GIF", "BMP", "WEBP"],
    }
