# Bulk Processor - Array Processing Sample

Demonstrates bulk/batch processing of multiple items on Runtime.

## What it does

Processes lists of items with various operations:

- Applies transformations to each item
- Handles errors gracefully (per-item or fail-fast)
- Tracks success/failure rates
- Exports results in multiple formats (JSON, CSV, Excel)

## Features Demonstrated

- **Array inputs** - Processing lists of items
- **Operation selection** - Enum/dropdown for operation type
- **Error handling** - Graceful per-item error handling
- **Progress tracking** - Success/failure counts
- **Multiple exports** - JSON, CSV, and Excel formats
- **Validation** - Email validation example

## API Endpoints

### POST /process_bulk

Process a list of items with the selected operation.

**Request:**
```json
{
  "items": ["hello", "world", "test"],
  "operation": "uppercase",
  "fail_on_error": false
}
```

**Operations:**
- `uppercase` - Convert to uppercase
- `lowercase` - Convert to lowercase
- `reverse` - Reverse string
- `length` - Get string length
- `hash` - Calculate hash

**Response:**
```json
{
  "total": 3,
  "successful": 3,
  "failed": 0,
  "operation": "uppercase",
  "results": [
    {
      "index": 0,
      "original": "hello",
      "processed": "HELLO",
      "success": true,
      "error": null
    },
    ...
  ]
}
```

**Artifacts:**
- `results.json` - Full detailed results
- `results.csv` - CSV format for Excel
- `results.xlsx` - Native Excel format
- `summary.json` - Summary statistics
- `failed_items.json` - Only failed items (if any)

### POST /validate_emails

Validate a list of email addresses.

**Request:**
```json
["user@example.com", "invalid-email", "test@domain.org"]
```

**Response:**
```json
{
  "total": 3,
  "valid": 2,
  "invalid": 1,
  "results": [...]
}
```

## Running Locally

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Test with curl:
```bash
curl -X POST http://localhost:8000/process_bulk \
  -H "Content-Type: application/json" \
  -d '{
    "items": ["apple", "banana", "cherry"],
    "operation": "uppercase"
  }'
```

## Production Use Cases

This pattern is useful for:

1. **Email validation** - Validate bulk email lists
2. **Data enrichment** - Enrich contacts with external APIs
3. **URL validation** - Check if URLs are alive
4. **Text analysis** - Sentiment analysis on multiple texts
5. **Image processing** - Batch resize/convert images
6. **Lead scoring** - Score multiple leads
7. **Data cleansing** - Clean and normalize bulk data

## Performance Tips

For large batches:

1. Add pagination (process in chunks)
2. Add progress streaming (not supported in v0)
3. Use async processing for I/O-bound operations
4. Add retry logic for transient failures
5. Consider using GPU lane for ML operations

## Error Handling Modes

**fail_on_error: false** (default)
- Process all items
- Return partial results
- Mark failed items individually

**fail_on_error: true**
- Stop at first error
- Return error immediately
- No partial results

Choose based on your use case:
- Data validation → fail_on_error: false
- Critical transactions → fail_on_error: true
