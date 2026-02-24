FROM python:3.11-slim

# System dependencies for WeasyPrint PDF generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (mirrors modal_app.py base image)
RUN pip install --no-cache-dir \
    "typing_extensions>=4.12.0" \
    "fastapi>=0.109.0" \
    "uvicorn==0.27.0" \
    "httpx>=0.26.0" \
    "pydantic>=2.5.3" \
    "python-multipart>=0.0.6" \
    "pandas>=2.1.4" \
    "numpy>=1.26.2" \
    "beautifulsoup4>=4.12.2" \
    "lxml>=4.9.3" \
    "requests>=2.31.0" \
    "orjson>=3.9.10" \
    "google-genai>=1.0.0" \
    "google-generativeai>=0.8.0" \
    "anthropic>=0.20.0" \
    "openai>=1.0.0" \
    "python-dotenv>=1.0.0" \
    "cryptography>=41.0.0" \
    "weasyprint>=60.0" \
    "python-docx>=1.0.0" \
    "markdown>=3.5.0" \
    "pybtex>=0.24.0" \
    "citeproc-py>=0.6.0" \
    "PyYAML>=6.0.0" \
    "rich>=13.0.0" \
    "tenacity>=8.0.0" \
    "psutil>=5.9.0"

# Set environment
ENV BASE_IMAGE_VERSION="2026-01-09-docker" \
    TZ=UTC \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_INPUT=1

# Copy execution modules
COPY src/execute /app/execute
COPY src/build /app/build
COPY src/artifacts /app/artifacts
COPY src/errors /app/errors
COPY src/security /app/security
COPY docker_entrypoint.py /app/docker_entrypoint.py

WORKDIR /app

ENTRYPOINT ["python", "/app/docker_entrypoint.py"]
