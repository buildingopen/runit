# FinOps Quick Start Guide

Quick reference for using the FinOps middleware in Execution Layer.

## Installation

```bash
cd services/control-plane
npm install
```

Dependencies added:
- `pg` - PostgreSQL client for retention cleanup

## Usage

### 1. Apply Middleware to Control Plane

```typescript
// services/control-plane/src/main.ts
import { Hono } from 'hono';
import {
  rateLimitMiddleware,
  quotaMiddleware,
  costMonitorMiddleware,
} from './middleware';

const app = new Hono();

// Apply FinOps middleware
app.use('*', rateLimitMiddleware);
app.use('*', quotaMiddleware);
app.use('*', costMonitorMiddleware);

// Your routes...
app.post('/runs', async (c) => {
  const runId = generateId();

  // Track run start
  c.req.quotaTracking?.trackStart(runId);

  try {
    // Execute run...
    const result = await executeRun();

    return c.json(result);
  } finally {
    // Track run completion
    c.req.quotaTracking?.trackComplete(runId);
  }
});
```

### 2. Setup Retention Cleanup Cron

```bash
# Create cron job (runs daily at 2 AM)
crontab -e

# Add this line:
0 2 * * * cd /path/to/execution-layer && npm run cleanup >> /var/log/cleanup.log 2>&1
```

### 3. Monitor Metrics

```typescript
import {
  getRateLimitStats,
  getQuotaStats,
  generateCostReport,
  getAggregateMetrics,
} from './middleware';

// Add admin endpoints
app.get('/admin/rate-limits', (c) => {
  return c.json(getRateLimitStats());
});

app.get('/admin/quotas', (c) => {
  return c.json(getQuotaStats());
});

app.get('/admin/cost-report', (c) => {
  const hours = Number(c.req.query('hours')) || 24;
  return c.text(generateCostReport(hours));
});

app.get('/admin/metrics', (c) => {
  return c.json(getAggregateMetrics());
});
```

## Testing

### Run Tests

```bash
cd services/control-plane
npm test -- src/middleware/__tests__
```

### Test Rate Limiting

```bash
# Test authenticated user limit (60/min)
for i in {1..65}; do
  curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/health
done
# Request 61+ should return 429
```

### Test Quota Enforcement

```bash
# Create 3 concurrent CPU runs (max is 2)
curl -X POST http://localhost:3001/runs -d '{"lane":"cpu"}' &
curl -X POST http://localhost:3001/runs -d '{"lane":"cpu"}' &
curl -X POST http://localhost:3001/runs -d '{"lane":"cpu"}' &
# 3rd run should return 429 quota exceeded
```

### Test Retention Cleanup

```bash
# Dry run
npm run cleanup:dry-run

# Actual cleanup
npm run cleanup

# With stats
STATS_FILE=/tmp/stats.json npm run cleanup
cat /tmp/stats.json
```

## Configuration

### Adjust Rate Limits

Edit `services/control-plane/src/middleware/rate-limit.ts`:

```typescript
const config = {
  authenticated: { requestsPerMinute: 60 },  // Change this
  anonymous: { requestsPerMinute: 10 },      // Change this
};
```

### Adjust Quotas

Edit `services/control-plane/src/middleware/quota.ts`:

```typescript
const quotaLimits = {
  cpu: {
    runsPerHour: 100,      // Change this
    maxConcurrent: 2       // Change this
  },
  gpu: {
    runsPerHour: 10,       // Change this
    maxConcurrent: 1       // Change this
  },
};
```

### Adjust Retention

Edit `infra/scripts/retention-cleanup.ts`:

```typescript
const config = {
  runs: { retentionDays: 30 },        // Change this
  artifacts: { retentionDays: 7 },    // Change this
  logs: { retentionHours: 24 },       // Change this
};
```

## Response Formats

### Rate Limit Exceeded (429)

```json
{
  "error": "Rate limit exceeded",
  "message": "Rate limit: 60 requests per minute for authenticated users",
  "retryAfter": 45,
  "limit": 60,
  "resetAt": 1735567890000
}
```

Headers:
- `X-RateLimit-Limit`: 60
- `X-RateLimit-Remaining`: 0
- `X-RateLimit-Reset`: 1735567890000

### Quota Exceeded (429)

```json
{
  "error": "Quota exceeded",
  "message": "CPU quota exceeded: 100 runs per hour",
  "lane": "cpu",
  "limits": {
    "cpu": { "runsPerHour": 100, "maxConcurrent": 2 },
    "gpu": { "runsPerHour": 10, "maxConcurrent": 1 }
  },
  "resetAt": 1735571490000,
  "retryAfter": 3600
}
```

## Troubleshooting

### Rate limits not working

- Check middleware is applied: `app.use('*', rateLimitMiddleware)`
- Check IP extraction: `req.ip` or `req.connection.remoteAddress`
- Verify auth middleware sets `req.user.id`

### Quotas not enforcing

- Check middleware is applied: `app.use('*', quotaMiddleware)`
- Verify auth middleware runs first
- Check run tracking: `trackStart()` and `trackComplete()` called

### Cleanup script failing

- Check DATABASE_URL environment variable
- Verify database schema matches expected tables
- Check permissions on stats file location

### Memory growing

- Rate limit store grows unbounded if cleanup disabled
- Verify cleanup interval is running: `setInterval(cleanupExpiredEntries, 60000)`
- Consider switching to Redis for production

## Production Checklist

- [ ] Apply all middleware to control plane
- [ ] Setup cron job for retention cleanup
- [ ] Configure monitoring endpoints
- [ ] Set up log aggregation for metrics
- [ ] Plan migration to Redis (if multi-instance)
- [ ] Test rate limiting under load
- [ ] Test quota enforcement under load
- [ ] Verify cleanup runs successfully
- [ ] Set up alerts for quota exhaustion
- [ ] Document rate limits in user-facing docs

## Next Steps

1. Integrate middleware into control-plane main.ts
2. Setup cron job for cleanup
3. Add monitoring dashboard
4. Plan Redis migration for production
5. Add cost estimation API

## Support

See full documentation:
- `services/control-plane/src/middleware/README.md`
- `infra/scripts/README.md`
- `agent-9-finops/FINOPS_IMPLEMENTATION_COMPLETE.md`
