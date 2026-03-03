# runit.yaml Specification

Version: 1.0

## Overview

`runit.yaml` is an optional configuration file that declares endpoint schemas, required secrets, and resource requirements for a RunIt project. When present in the code bundle root, the server reads it during deployment and the runner reads it during execution.

Without `runit.yaml`, RunIt auto-detects everything via AST analysis. With `runit.yaml`, declared values take precedence over auto-detected ones.

## File Location

Place `runit.yaml` (or `runit.yml`) at the root of your code bundle (ZIP) or alongside your `main.py`.

## Full Example

```yaml
name: invoice-generator
version: 1
runtime: python3.11
entrypoint: main:app

endpoints:
  POST /generate:
    summary: Generate an invoice PDF
    description: Creates a formatted invoice and returns it as a downloadable PDF.
    inputs:
      type: object
      required: [client_name, amount]
      properties:
        client_name:
          type: string
          description: Client or company name
        amount:
          type: number
          description: Invoice amount in USD
        currency:
          type: string
          enum: [USD, EUR, GBP]
          default: USD
    outputs:
      type: object
      properties:
        invoice_id:
          type: string
        total:
          type: number
        pdf_url:
          type: string
    timeout_seconds: 30

secrets:
  - STRIPE_API_KEY
  - PDF_SERVICE_KEY

network: true

dependencies:
  - fpdf2==2.7.4
  - stripe==5.0.0
```

## Fields

### Top-level

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Project display name (overrides auto-detected) |
| `version` | number or string | No | Project version identifier |
| `runtime` | string | No | Python runtime version (e.g. `python3.11`) |
| `entrypoint` | string | No | Override auto-detected entrypoint (e.g. `main:app`) |
| `endpoints` | object | No | Endpoint declarations (key: endpoint identifier) |
| `secrets` | array or object | No | Required environment variables/secrets |
| `network` | boolean | No | Whether endpoints need outbound network access (default: `false`) |
| `dependencies` | array | No | Python package requirements |

### Endpoint Key Format

Endpoint keys can be:
- `POST /generate` - method + path (most explicit)
- `/generate` - path only (matches any method)
- `generate` - name only (auto-prefixed with `/`)

### Endpoint Fields

| Field | Type | Description |
|-------|------|-------------|
| `summary` | string | Short one-line description |
| `description` | string | Longer description |
| `inputs` | JSON Schema object | Request body schema |
| `outputs` | JSON Schema object | Response body schema |
| `lane` | `cpu` or `gpu` | Compute lane override |
| `timeout_seconds` | number | Per-endpoint timeout override |

### Secrets

Secrets can be declared as a simple list or with metadata:

```yaml
# Simple list (all required)
secrets:
  - STRIPE_API_KEY
  - DATABASE_URL

# With metadata
secrets:
  STRIPE_API_KEY:
    description: Stripe API key for payment processing
    required: true
  DEBUG_MODE:
    description: Enable debug logging
    required: false
```

## Behavior

### Deploy Time (Control Plane)
1. Extract endpoints via AST analysis (auto-wrap if needed)
2. Read `runit.yaml` if present
3. Merge: runit.yaml `summary`, `description`, `inputs`, `outputs` override auto-detected values
4. Merge: runit.yaml `secrets` are added to detected env vars
5. Store merged endpoints and config in version metadata

### Run Time (Runner)
1. Extract code bundle
2. Read `runit.yaml` if present
3. Validate required secrets are in the environment (log warning if missing)
4. Use `entrypoint` from runit.yaml if specified
5. Execute endpoint

### Precedence
- runit.yaml values override auto-detected values
- Inline `config` in deploy request overrides file-based runit.yaml
- Deploy request `entrypoint` field overrides all

## Examples

### Minimal

```yaml
secrets:
  - OPENAI_API_KEY
```

### Multi-endpoint

```yaml
endpoints:
  analyze:
    summary: Analyze text sentiment
    inputs:
      type: object
      required: [text]
      properties:
        text:
          type: string
  summarize:
    summary: Summarize text
    inputs:
      type: object
      required: [text, max_length]
      properties:
        text:
          type: string
        max_length:
          type: integer
          default: 100
```

### GPU Workload

```yaml
endpoints:
  POST /predict:
    summary: Run ML inference
    lane: gpu
    timeout_seconds: 120
    inputs:
      type: object
      required: [image]
      properties:
        image:
          type: string
          description: Base64-encoded image
```
