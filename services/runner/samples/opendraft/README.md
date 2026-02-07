# OpenDraft - AI Research Paper Generator

Generate master-level research papers with real citations using AI.

## Features

- Generates complete research papers on any topic
- Real citations from Crossref, Semantic Scholar, and Google Scholar
- Multiple output formats: PDF, DOCX, Markdown
- Configurable academic levels and citation styles

## API Endpoints

### POST /generate

Generate a research paper.

**Request:**
```json
{
  "topic": "Impact of AI on Healthcare",
  "level": "research_paper",
  "citation_style": "apa",
  "language": "en"
}
```

**Response:**
```json
{
  "success": true,
  "topic": "Impact of AI on Healthcare",
  "word_count": 6500,
  "citation_count": 45,
  "artifacts": [
    "impact_of_ai_on_healthcare.pdf",
    "impact_of_ai_on_healthcare.docx",
    "impact_of_ai_on_healthcare.md",
    "research_data.zip"
  ]
}
```

### GET /health

Health check endpoint.

## Required Environment Variables

- `GOOGLE_API_KEY` - Google Gemini API key for AI generation

## Artifacts Generated

| File | Description |
|------|-------------|
| `*.pdf` | Final formatted PDF document |
| `*.docx` | Microsoft Word document |
| `*.md` | Markdown source |
| `research_data.zip` | Raw research data and citations |
| `generation_metadata.json` | Generation statistics |

## Execution Time

Typical generation takes 10-15 minutes depending on topic complexity.
