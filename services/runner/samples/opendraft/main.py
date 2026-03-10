"""
OpenDraft - AI Research Paper Generator for Runtime.

Generates master-level research papers with real citations using AI.

Demonstrates:
- Long-running AI generation tasks
- Multiple output artifacts (PDF, DOCX, MD)
- Environment variable handling (API keys)
"""

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# Add SDK to path (for local development)
sdk_path = Path(__file__).parent.parent.parent / "sdk"
if sdk_path.exists():
    sys.path.insert(0, str(sdk_path))

# Try to import SDK, fallback to local implementations
try:
    from runit import save_artifact, save_json
except ImportError:
    # Local fallback for testing
    import json as _json

    ARTIFACTS_DIR = Path(os.getenv("EL_ARTIFACTS_DIR", "/tmp/artifacts"))

    def save_artifact(filename: str, data: bytes | str) -> str:
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        path = ARTIFACTS_DIR / filename
        if isinstance(data, str):
            path.write_text(data, encoding="utf-8")
        else:
            path.write_bytes(data)
        return str(path)

    def save_json(filename: str, data) -> str:
        return save_artifact(filename, _json.dumps(data, indent=2))


app = FastAPI(
    title="OpenDraft",
    description="AI-powered research paper generator with real citations",
    version="1.6.26",
)


class GenerateRequest(BaseModel):
    """Request to generate a research paper."""

    topic: str = Field(..., description="Research topic or thesis title", min_length=5)
    level: Literal["research_paper", "bachelor", "master", "phd"] = Field(
        default="research_paper", description="Academic level of the paper"
    )
    citation_style: Literal["apa", "ieee", "chicago"] = Field(
        default="apa", description="Citation format style"
    )
    language: str = Field(default="en", description="Output language code (en, de, es, etc.)")


class GenerateResponse(BaseModel):
    """Response from paper generation."""

    success: bool = Field(..., description="Whether generation succeeded")
    topic: str = Field(..., description="The research topic")
    word_count: int = Field(default=0, description="Approximate word count")
    citation_count: int = Field(default=0, description="Number of citations found")
    artifacts: list[str] = Field(default=[], description="List of generated artifact filenames")
    error: Optional[str] = Field(None, description="Error message if failed")


@app.post("/generate", response_model=GenerateResponse)
async def generate_paper(req: GenerateRequest) -> GenerateResponse:
    """
    Generate a research paper on the given topic.

    This endpoint:
    1. Runs OpenDraft CLI to generate a paper
    2. Collects all output files (PDF, DOCX, MD)
    3. Saves them as artifacts for download
    4. Returns generation statistics

    Requires GOOGLE_API_KEY environment variable to be set.
    """

    # Check for API key
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=400, detail="GOOGLE_API_KEY or GEMINI_API_KEY environment variable required"
        )

    # Create temp directory for output
    with tempfile.TemporaryDirectory() as tmpdir:
        output_dir = Path(tmpdir) / "output"
        output_dir.mkdir()

        try:
            # Run OpenDraft CLI
            cmd = [
                sys.executable,
                "-m",
                "opendraft.cli",
                req.topic,
                "--level",
                req.level,
                "--style",
                req.citation_style,
                "--lang",
                req.language,
                "--output",
                str(output_dir),
            ]

            env = os.environ.copy()
            env["GOOGLE_API_KEY"] = api_key

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=1800,  # 30 minute timeout
                env=env,
                cwd=tmpdir,
            )

            if result.returncode != 0:
                error_msg = result.stderr or result.stdout or "Unknown error"
                return GenerateResponse(
                    success=False, topic=req.topic, error=f"Generation failed: {error_msg[:500]}"
                )

            # Collect artifacts from exports directory
            exports_dir = output_dir / "exports"
            artifacts = []
            word_count = 0
            citation_count = 0

            if exports_dir.exists():
                for file_path in exports_dir.iterdir():
                    if file_path.is_file():
                        # Save each export as artifact
                        with open(file_path, "rb") as f:
                            content = f.read()
                        save_artifact(file_path.name, content)
                        artifacts.append(file_path.name)

                        # Extract stats from markdown file
                        is_md = file_path.suffix == ".md"
                        if is_md and not file_path.name.startswith("INTERMEDIATE"):
                            text = file_path.read_text()
                            word_count = len(text.split())
                            # Count citations (rough estimate)
                            citation_count = text.count("et al.") + text.count("(20")

            # Also save the research folder as a zip
            research_dir = output_dir / "research"
            if research_dir.exists():
                research_zip = Path(tmpdir) / "research_data.zip"
                shutil.make_archive(str(research_zip.with_suffix("")), "zip", research_dir)
                with open(research_zip, "rb") as f:
                    save_artifact("research_data.zip", f.read())
                artifacts.append("research_data.zip")

            # Save generation metadata
            metadata = {
                "topic": req.topic,
                "level": req.level,
                "citation_style": req.citation_style,
                "language": req.language,
                "word_count": word_count,
                "citation_count": citation_count,
                "artifacts": artifacts,
            }
            save_json("generation_metadata.json", metadata)

            return GenerateResponse(
                success=True,
                topic=req.topic,
                word_count=word_count,
                citation_count=citation_count,
                artifacts=artifacts,
            )

        except subprocess.TimeoutExpired:
            return GenerateResponse(
                success=False, topic=req.topic, error="Generation timed out after 30 minutes"
            )
        except Exception as e:
            return GenerateResponse(success=False, topic=req.topic, error=str(e))


@app.get("/")
async def root():
    """Health check and service info."""
    return {
        "service": "OpenDraft",
        "description": "AI Research Paper Generator",
        "version": "1.6.26",
        "status": "ready",
        "endpoints": {"POST /generate": "Generate a research paper on any topic"},
        "required_env": ["GOOGLE_API_KEY"],
        "output_formats": ["PDF", "DOCX", "Markdown", "ZIP bundle"],
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    # Verify opendraft is installed
    try:
        from opendraft.version import __version__

        return {"status": "healthy", "opendraft_version": __version__}
    except ImportError:
        raise HTTPException(status_code=503, detail="OpenDraft package not installed")
