# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately:

1. **Do not** open a public GitHub issue
2. Email security concerns to: **hello@buildingopen.org**
3. Include a detailed description of the vulnerability
4. Provide steps to reproduce if possible

We will respond within 48 hours and work with you to understand and resolve the issue.

## Security Features

### Secrets Management
- All secrets are encrypted at rest using AES-256-GCM
- Secrets are decrypted only at execution time within isolated containers
- Master encryption keys are never exposed to user code

### Execution Isolation
- User code runs in isolated Docker containers
- Each execution gets a fresh environment
- No persistent state between runs
- Network access is controlled

### Input Validation
- All API inputs are validated and sanitized
- File uploads are scanned and size-limited
- ZIP extraction has path traversal protection

## Implemented Security Controls

- **Rate limiting** — Per-user and per-IP request throttling
- **Quota enforcement** — CPU/GPU usage limits per user
- **Authorization checks** — Ownership verification on all resources
- **Zip bomb protection** — Compression ratio limits on uploads

## Planned Enhancements

- Enhanced audit logging
- SOC 2 compliance controls
- Container escape detection

## Security Best Practices

When using RunIt:

- Never commit secrets to your uploaded code
- Use the secrets management system for sensitive values
- Review the OpenAPI schema before sharing public links
- Monitor your execution logs for unexpected behavior
