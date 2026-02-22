# Image Analysis - File Upload Sample

Demonstrates file upload handling and image processing on Runtime.

## What it does

Analyzes uploaded images and generates processed variants:

- Extracts image metadata (dimensions, format, color mode)
- Calculates image statistics (brightness, dominant color)
- Generates multiple thumbnail sizes
- Applies filters (blur, sharpen)
- Saves all variants as downloadable artifacts

## Features Demonstrated

- **File upload** - FastAPI UploadFile handling
- **Image processing** - PIL/Pillow operations
- **Multiple artifacts** - Original, thumbnails, filtered versions
- **Structured analysis** - Detailed image metadata
- **Error handling** - Invalid file validation

## API Endpoints

### POST /analyze_image

Analyze an uploaded image.

**Request:**
- Multipart form data with `file` field

**Response:**
```json
{
  "filename": "photo.jpg",
  "format": "JPEG",
  "mode": "RGB",
  "width": 1920,
  "height": 1080,
  "size_bytes": 245680,
  "aspect_ratio": 1.78,
  "is_grayscale": false,
  "average_brightness": 128.5,
  "dominant_color": "#3a5f8c"
}
```

**Artifacts:**
- `original_photo.jpg` - Original image
- `thumbnail_200.png` - Small thumbnail (200x200)
- `thumbnail_800.png` - Medium thumbnail (800x800)
- `blurred.png` - Gaussian blur applied
- `sharpened.png` - Sharpened version
- `analysis.json` - Full analysis results

## Running Locally

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Test with curl:
```bash
curl -X POST -F "file=@image.jpg" http://localhost:8000/analyze_image
```

## Supported Formats

- JPEG/JPG
- PNG
- GIF
- BMP
- WEBP
- And many more via PIL/Pillow

## Production Enhancements

For production use, consider:

1. Add image validation (max size, dimensions)
2. Support batch processing (multiple images)
3. Add more filters and effects
4. Integrate ML models (object detection, face recognition)
5. Add watermarking capabilities
6. Support video thumbnail generation
7. Add EXIF data extraction

## Use Cases

- Profile picture processing
- Product image thumbnails
- Image quality analysis
- Batch image optimization
- Content moderation pipelines
