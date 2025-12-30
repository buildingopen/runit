# FinOps Middleware

Cost control and quota enforcement middleware for the Execution Layer control plane.

## Overview

This directory contains middleware for:

1. **Rate Limiting** - Per-IP and per-user request throttling
2. **Quota Enforcement** - Run limits and concurrency controls
3. **Cost Monitoring** - Metrics tracking and cost analysis

## Components

### Rate Limiting (`rate-limit.ts`)

Implements per-IP rate limiting to prevent abuse:

- **Authenticated users**: 60 requests/minute
- **Anonymous users**: 10 requests/minute
- **Share links**: 100 runs/hour per link

```typescript
import { rateLimitMiddleware, shareLinkRateLimitMiddleware } from './middleware';

app.use(rateLimitMiddleware);
app.post('/s/:shareLinkId/run', shareLinkRateLimitMiddleware, handler);
```

**Returns 429** with clear message when exceeded.

### Quota Enforcement (`quota.ts`)

Enforces usage quotas per user:

- **CPU**: 100 runs/hour, 2 concurrent runs
- **GPU**: 10 runs/hour, 1 concurrent run

```typescript
import { quotaMiddleware } from './middleware';

app.post('/runs', quotaMiddleware, async (req, res) => {
  // Track run start
  req.quotaTracking.trackStart(runId);

  try {
    // Execute run...
  } finally {
    // Track run completion
    req.quotaTracking.trackComplete(runId);
  }
});
```

**Returns 429** with quota details when exceeded.

### Cost Monitoring (`cost-monitor.ts`)

Tracks metrics for cost analysis:

- Run count by lane (CPU/GPU)
- Duration aggregates (avg, p50, p95, p99)
- Success rates
- Per-user and per-project metrics

```typescript
import { costMonitorMiddleware, getAggregateMetrics } from './middleware';

app.use(costMonitorMiddleware);

// Get metrics
const metrics = getAggregateMetrics();
console.log(metrics);
```

Logs structured metrics to console/file.

## Usage

### Basic Setup

```typescript
import express from 'express';
import { rateLimitMiddleware, quotaMiddleware, costMonitorMiddleware } from './middleware';

const app = express();

// Apply middleware
app.use(rateLimitMiddleware);
app.use(quotaMiddleware);
app.use(costMonitorMiddleware);

// Routes...
```

### Monitoring Endpoints

```typescript
import { getRateLimitStats, getQuotaStats, generateCostReport } from './middleware';

// Admin endpoints
app.get('/admin/rate-limits', (req, res) => {
  res.json(getRateLimitStats());
});

app.get('/admin/quotas', (req, res) => {
  res.json(getQuotaStats());
});

app.get('/admin/cost-report', (req, res) => {
  const report = generateCostReport(24); // Last 24 hours
  res.type('text/plain').send(report);
});
```

## Storage

**v0**: In-memory storage (Map)
**Production**: Replace with Redis for:
- Distributed rate limiting
- Persistent quota tracking
- Shared metrics across instances

## Testing

```bash
npm test -- src/middleware/__tests__
```

Tests cover:
- Rate limit enforcement
- Quota enforcement
- Concurrent run tracking
- Edge cases

## Configuration

Rate limits and quotas are defined as constants in each module.

To modify limits, edit the config objects:

```typescript
// rate-limit.ts
const config = {
  authenticated: { requestsPerMinute: 60 },
  anonymous: { requestsPerMinute: 10 },
};

// quota.ts
const quotaLimits = {
  cpu: { runsPerHour: 100, maxConcurrent: 2 },
  gpu: { runsPerHour: 10, maxConcurrent: 1 },
};
```

## Future Enhancements

- [ ] Redis backend for distributed operation
- [ ] Per-tier quotas (free/pro/enterprise)
- [ ] Dynamic quota adjustments
- [ ] Cost estimation before run
- [ ] Budget alerts
- [ ] Export metrics to DataDog/CloudWatch
