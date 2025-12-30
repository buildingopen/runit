# Infrastructure Scripts

Operational scripts for the Execution Layer.

## Retention Cleanup

### Overview

The `retention-cleanup.ts` script enforces data retention policies:

- **Runs**: Delete after 30 days
- **Artifacts**: Delete after 7 days
- **Logs**: Clear after 24 hours

### Usage

```bash
# Dry run (see what would be deleted)
npm run cleanup -- --dry-run

# Actual cleanup
npm run cleanup

# With stats output
STATS_FILE=/tmp/cleanup-stats.json npm run cleanup
```

### Cron Setup

Run daily at 2 AM:

```cron
0 2 * * * cd /path/to/execution-layer && npm run cleanup >> /var/log/cleanup.log 2>&1
```

### Configuration

Retention periods are defined in the script:

```typescript
const config = {
  runs: { retentionDays: 30 },
  artifacts: { retentionDays: 7 },
  logs: { retentionHours: 24 },
};
```

### Database Requirements

Requires the following tables:
- `runs` - with `created_at`, `logs` columns
- `artifacts` - with `created_at`, `storage_ref` columns

### Output

```
Starting retention cleanup...
  - Runs deleted: 123
  - Artifacts deleted: 456
  - Logs cleared: 789
  - Duration: 1234ms
```

### Stats File

If `STATS_FILE` is set, writes JSON:

```json
{
  "runsDeleted": 123,
  "artifactsDeleted": 456,
  "logsCleared": 789,
  "duration": 1234,
  "timestamp": "2024-12-30T12:34:56Z"
}
```

### Error Handling

- Exits with code 0 on success
- Exits with code 1 on failure
- Logs errors to stderr

### Testing

```bash
# Dry run to verify
npm run cleanup -- --dry-run

# Check expected deletions
npm run cleanup -- --dry-run | grep "count"
```

### Future Enhancements

- [ ] S3 artifact cleanup (currently DB only)
- [ ] Configurable retention periods
- [ ] Selective cleanup by project/user
- [ ] Metrics export to monitoring
- [ ] Archive before delete option
