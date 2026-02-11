# Load Testing Infrastructure

This directory contains k6 load test scenarios for the control-plane service.

## Prerequisites

### Installing k6

**macOS (Homebrew):**
```bash
brew install k6
```

**Linux (Debian/Ubuntu):**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows (Chocolatey):**
```bash
choco install k6
```

**Docker:**
```bash
docker pull grafana/k6
```

## Directory Structure

```
tests/load/
├── k6-config.js           # Main configuration with scenario definitions
├── README.md              # This file
├── results/               # Generated test results (gitignored)
└── scenarios/
    ├── health-check.js    # Health endpoint load test
    ├── create-project.js  # Project creation flow test
    ├── secrets-crud.js    # Secrets CRUD operations test
    └── mixed-workload.js  # Realistic mixed traffic simulation
```

## Running Load Tests

### Quick Start

```bash
# From the control-plane directory
npm run test:load              # Run smoke test (default)
npm run test:load:smoke        # Run smoke test explicitly
npm run test:load:scenario     # Run full load test
```

### Individual Scenarios

```bash
# Health check (simplest test)
k6 run tests/load/scenarios/health-check.js

# Project creation flow
k6 run tests/load/scenarios/create-project.js

# Secrets CRUD operations
k6 run tests/load/scenarios/secrets-crud.js

# Mixed realistic workload
k6 run tests/load/scenarios/mixed-workload.js
```

### Using Configuration File

```bash
# Smoke test (1 VU, 30s)
k6 run tests/load/k6-config.js --env SCENARIO=smoke

# Load test (50 VUs, 5m)
k6 run tests/load/k6-config.js --env SCENARIO=load

# Stress test (ramping to 100 VUs, 10m)
k6 run tests/load/k6-config.js --env SCENARIO=stress

# Spike test (sudden 200 VUs)
k6 run tests/load/k6-config.js --env SCENARIO=spike
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3001` | Target server URL |
| `AUTH_TOKEN` | (empty) | Bearer token for authenticated requests |
| `SCENARIO` | `smoke` | Scenario to run (smoke/load/stress/spike) |
| `VUS` | varies | Override virtual users count |
| `DURATION` | varies | Override test duration |
| `TEST_PROJECT_ID` | `test-project-id` | Project ID for secrets tests |
| `TEST_ZIP_DATA` | (minimal) | Base64 ZIP data for project creation |

### Example with Custom Settings

```bash
# Custom URL and authentication
k6 run tests/load/scenarios/mixed-workload.js \
  --env BASE_URL=https://api.staging.example.com \
  --env AUTH_TOKEN=your-jwt-token

# Custom VUs and duration
k6 run tests/load/scenarios/health-check.js \
  --env VUS=20 \
  --env DURATION=5m
```

## Scenario Descriptions

### 1. Smoke Test (`smoke`)
- **Purpose:** Quick validation that the service is working
- **VUs:** 1
- **Duration:** 30 seconds
- **Use case:** CI/CD pre-deployment check, quick sanity test

### 2. Load Test (`load`)
- **Purpose:** Measure performance under typical production load
- **VUs:** 50 concurrent users
- **Duration:** 5 minutes
- **Use case:** Regular performance baseline measurement

### 3. Stress Test (`stress`)
- **Purpose:** Find the breaking point of the system
- **VUs:** Ramps from 0 to 100
- **Duration:** 10 minutes
- **Stages:**
  - Warm up (0 → 20 VUs)
  - Normal load (20 → 50 VUs)
  - Peak load (50 → 100 VUs)
  - Sustained peak
  - Cool down
- **Use case:** Capacity planning, identifying bottlenecks

### 4. Spike Test (`spike`)
- **Purpose:** Test system behavior under sudden traffic spikes
- **VUs:** Sudden jump to 200
- **Duration:** ~4 minutes
- **Use case:** Testing autoscaling, circuit breaker behavior

## Expected Baselines

These are target performance baselines for a healthy service:

### Health Check Endpoint
| Metric | Target | Critical |
|--------|--------|----------|
| p95 Latency | < 50ms | > 100ms |
| p99 Latency | < 100ms | > 200ms |
| Error Rate | < 0.1% | > 1% |

### Project List/Get
| Metric | Target | Critical |
|--------|--------|----------|
| p95 Latency | < 200ms | > 500ms |
| p99 Latency | < 500ms | > 1000ms |
| Error Rate | < 1% | > 5% |

### Project Creation
| Metric | Target | Critical |
|--------|--------|----------|
| p95 Latency | < 3s | > 5s |
| p99 Latency | < 5s | > 10s |
| Error Rate | < 2% | > 5% |

### Secrets Operations
| Metric | Target | Critical |
|--------|--------|----------|
| p95 Latency | < 300ms | > 500ms |
| p99 Latency | < 500ms | > 1000ms |
| Error Rate | < 1% | > 5% |

## Interpreting Results

### Key Metrics

1. **http_req_duration** - Response time distribution
   - `avg` - Average response time
   - `p(95)` - 95th percentile (95% of requests faster than this)
   - `p(99)` - 99th percentile (worst case excluding outliers)

2. **http_req_failed** - Request failure rate
   - Network errors, timeouts, 5xx responses
   - Target: < 1% for normal load, < 5% under stress

3. **http_reqs** - Request throughput
   - `count` - Total requests made
   - `rate` - Requests per second

4. **vus** - Virtual users
   - Active concurrent users at any point

### Sample Output Interpretation

```
     ✓ health status is 200
     ✓ health response time < 100ms

     http_req_duration..............: avg=45.2ms  p(95)=78.5ms  p(99)=125.3ms
     http_req_failed................: 0.12%  ✓ 3    ✗ 2497
     http_reqs......................: 2500   83.33/s
```

This shows:
- All checks passed (status 200, response < 100ms)
- Average response time: 45.2ms (good)
- 95th percentile: 78.5ms (under 100ms target)
- 99th percentile: 125.3ms (slightly over but acceptable)
- Error rate: 0.12% (under 1% target)
- Throughput: ~83 requests/second

### Threshold Failures

If thresholds fail, k6 exits with code 99:
```
     ✗ http_req_duration..............: avg=450ms p(95)=890ms p(99)=1.2s
        ✗ p(95)<500...................: p(95)=890ms
```

This indicates the p95 latency exceeded the 500ms threshold.

## Output Formats

### JSON Results
Results are automatically saved to `tests/load/results/`:
```bash
mkdir -p tests/load/results
k6 run tests/load/scenarios/health-check.js
# Creates: tests/load/results/health-check-summary.json
```

### Cloud Reporting (k6 Cloud)
```bash
k6 cloud tests/load/scenarios/mixed-workload.js
```

### InfluxDB + Grafana
```bash
k6 run tests/load/scenarios/mixed-workload.js \
  --out influxdb=http://localhost:8086/k6
```

### Prometheus
```bash
K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write \
k6 run tests/load/scenarios/mixed-workload.js --out experimental-prometheus-rw
```

## Troubleshooting

### Common Issues

1. **Connection refused**
   - Ensure the control-plane service is running
   - Check BASE_URL is correct
   - Verify firewall/network settings

2. **401 Unauthorized errors**
   - Provide valid AUTH_TOKEN
   - Check token hasn't expired

3. **High error rates during spike test**
   - This may be expected behavior
   - Check if errors recover after spike subsides
   - Review circuit breaker and rate limiting settings

4. **Timeout errors**
   - Increase timeout in k6 options
   - Check server-side timeout configurations

### Debug Mode

```bash
# Verbose output
k6 run tests/load/scenarios/health-check.js --verbose

# HTTP debug
k6 run tests/load/scenarios/health-check.js --http-debug
```

## CI/CD Integration

Load tests are integrated into the GitHub Actions workflow:

- **On Pull Request:** Smoke test runs automatically
- **Manual Trigger:** Full load/stress tests can be triggered manually

See `.github/workflows/load-test.yml` for configuration.
