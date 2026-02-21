"""
Bulk Processor - Array processing sample app for Execution Layer.

Demonstrates:
- Processing arrays/lists of items
- Progress tracking
- Batch operations
- CSV/Excel export
- Error handling for individual items
"""

import sys
from pathlib import Path
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field

# Add SDK to path (for local development)
sdk_path = Path(__file__).parent.parent.parent / "sdk"
if sdk_path.exists():
    sys.path.insert(0, str(sdk_path))

from execution_layer import save_artifact, save_dataframe, save_json  # noqa: E402

app = FastAPI(
    title="Bulk Processor",
    description="Process multiple items in bulk with detailed results",
    version="1.0.0",
)


class BulkRequest(BaseModel):
    """Request to process multiple items."""

    items: list[str] = Field(
        ...,
        description="List of items to process",
        min_length=1,
        max_length=1000,
        examples=[["hello", "world", "test"]],
    )
    operation: Literal["uppercase", "lowercase", "reverse", "length", "hash"] = Field(
        default="uppercase", description="Operation to apply to each item"
    )
    fail_on_error: bool = Field(
        default=False, description="Whether to fail entire batch if one item fails"
    )


class ProcessedItem(BaseModel):
    """Result of processing a single item."""

    index: int = Field(..., description="Item index in original list")
    original: str = Field(..., description="Original item value")
    processed: str | None = Field(None, description="Processed result")
    success: bool = Field(..., description="Whether processing succeeded")
    error: str | None = Field(None, description="Error message if failed")


class BulkResponse(BaseModel):
    """Response from bulk processing."""

    total: int = Field(..., description="Total items processed")
    successful: int = Field(..., description="Number of successful items")
    failed: int = Field(..., description="Number of failed items")
    operation: str = Field(..., description="Operation applied")
    results: list[ProcessedItem] = Field(..., description="Detailed results")


@app.post("/process_bulk", response_model=BulkResponse)
async def process_bulk(req: BulkRequest) -> BulkResponse:
    """
    Process multiple items in bulk.

    This endpoint:
    1. Applies operation to each item
    2. Handles errors gracefully
    3. Generates detailed per-item results
    4. Saves results in multiple formats
    """

    results: list[ProcessedItem] = []
    successful = 0
    failed = 0

    for index, item in enumerate(req.items):
        try:
            # Apply operation
            if req.operation == "uppercase":
                processed = item.upper()
            elif req.operation == "lowercase":
                processed = item.lower()
            elif req.operation == "reverse":
                processed = item[::-1]
            elif req.operation == "length":
                processed = str(len(item))
            elif req.operation == "hash":
                processed = str(hash(item))
            else:
                raise ValueError(f"Unknown operation: {req.operation}")

            results.append(
                ProcessedItem(
                    index=index, original=item, processed=processed, success=True, error=None
                )
            )
            successful += 1

        except Exception as e:
            error_msg = str(e)

            if req.fail_on_error:
                # Re-raise to fail entire batch
                raise

            results.append(
                ProcessedItem(
                    index=index, original=item, processed=None, success=False, error=error_msg
                )
            )
            failed += 1

    # Save detailed results as JSON
    results_data = {
        "total": len(req.items),
        "successful": successful,
        "failed": failed,
        "operation": req.operation,
        "results": [r.model_dump() for r in results],
    }
    save_json("results.json", results_data)

    # Save as CSV (for easy Excel import)
    try:
        import pandas as pd

        df_data = []
        for r in results:
            df_data.append(
                {
                    "index": r.index,
                    "original": r.original,
                    "processed": r.processed or "",
                    "success": r.success,
                    "error": r.error or "",
                }
            )

        df = pd.DataFrame(df_data)
        save_dataframe(df, "results.csv", format="csv")

        # Also save as Excel if openpyxl is available
        try:
            save_dataframe(df, "results.xlsx", format="excel")
        except (ImportError, TypeError):
            pass  # openpyxl not available

    except ImportError:
        # If pandas not available, create simple CSV
        csv_lines = ["index,original,processed,success,error"]
        for r in results:
            csv_lines.append(
                f'{r.index},"{r.original}","{r.processed or ""}",{r.success},"{r.error or ""}"'
            )
        save_artifact("results.csv", "\n".join(csv_lines))

    # Save summary statistics
    summary = {
        "total_items": len(req.items),
        "successful": successful,
        "failed": failed,
        "success_rate": round(successful / len(req.items) * 100, 2) if req.items else 0,
        "operation": req.operation,
        "fail_on_error": req.fail_on_error,
    }
    save_json("summary.json", summary)

    # Save failed items separately if any
    if failed > 0:
        failed_items = [r for r in results if not r.success]
        save_json("failed_items.json", [r.model_dump() for r in failed_items])

    return BulkResponse(
        total=len(req.items),
        successful=successful,
        failed=failed,
        operation=req.operation,
        results=results,
    )


@app.post("/validate_emails")
async def validate_emails(emails: list[str]) -> dict:
    """
    Example: Validate a list of email addresses.

    Demonstrates bulk processing with validation logic.
    """
    import re

    email_regex = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")

    results = []
    valid_count = 0

    for email in emails:
        is_valid = bool(email_regex.match(email))
        if is_valid:
            valid_count += 1

        results.append(
            {"email": email, "valid": is_valid, "reason": None if is_valid else "Invalid format"}
        )

    # Save results
    save_json("email_validation.json", results)

    try:
        import pandas as pd

        df = pd.DataFrame(results)
        save_dataframe(df, "email_validation.csv")
    except ImportError:
        pass

    return {
        "total": len(emails),
        "valid": valid_count,
        "invalid": len(emails) - valid_count,
        "results": results,
    }


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "service": "Bulk Processor",
        "status": "ready",
        "version": "1.0.0",
        "operations": ["uppercase", "lowercase", "reverse", "length", "hash"],
    }
