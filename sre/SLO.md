# QuickBite - Service Level Indicators, Objectives and Agreement

## 1. Users and critical journey
Students pre-order food before the 1:00 pm lunch rush. The **critical user journey** is
*"open menu → place order → receive token"*. If order placement is slow or fails at 1 pm,
students miss lunch, so the SLOs focus on `POST /api/orders`.

## 2. SLI / SLO / SLA

| Term | Definition for QuickBite | How it is measured (PromQL) |
|---|---|---|
| **SLI 1 - Availability** | Share of API requests that do **not** return a 5xx error | `1 - sum(rate(http_requests_total{route=~"/api/.*",status_code=~"5.."}[5m])) / sum(rate(http_requests_total{route=~"/api/.*"}[5m]))` (recorded as `quickbite:availability:rate5m`) |
| **SLI 2 - Latency** | 95th percentile response time of `POST /api/orders` | `histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{route="/api/orders",method="POST"}[5m])))` (recorded as `quickbite:order_latency_p95:rate5m`) |
| **SLO 1** | Availability ≥ **99.5%** over a rolling 30 days | Grafana "Availability" stat, alert `QuickBiteHighErrorRate` |
| **SLO 2** | p95 order latency **< 300 ms** over a rolling 30 days | Grafana "p95 order latency" stat, alert `QuickBiteHighLatency` |
| **SLA** | Availability ≥ **99.0%** per month, promised to the canteen vendor. If breached, the IT team provides a manual token-counter backup during lunch for the next week. | Monthly report from Prometheus |

> The SLO (99.5%) is deliberately **stricter** than the SLA (99.0%), so the team gets warned
> long before the external promise is broken.

## 3. Error budget

| Item | Value |
|---|---|
| Allowed failure ratio | 100% − 99.5% = **0.5%** |
| Example | For 10,000 orders in a month, up to **50** may fail |
| Downtime equivalent (30 days) | 0.005 × 30 × 24 × 60 ≈ **216 minutes** |
| Fast-burn alert | Error ratio > 14.4 × 0.5% = **7.2%** in both the 5 m and 1 h windows → budget gone in ~2 days |

### Error-budget policy
1. **Budget > 50% left:** normal releases through the CI/CD pipeline.
2. **Budget 0–50% left:** only bug-fix releases, and every release goes through a **canary** first.
3. **Budget exhausted:** feature freeze. Only reliability fixes until the budget recovers.

## 4. Alerts (monitoring/prometheus-rules.yaml)

| Alert | Condition | Severity |
|---|---|---|
| `QuickBiteDown` | No healthy pod scraped for 1 m | critical |
| `QuickBiteHighErrorRate` | 5xx ratio > 2% for 2 m | critical |
| `QuickBiteHighLatency` | p95 order latency > 300 ms for 2 m | warning |
| `QuickBiteErrorBudgetFastBurn` | Burn rate > 14.4× in 5 m and 1 h windows | critical |

## 5. Three pillars of observability in this project

| Pillar | Tool | What it answers |
|---|---|---|
| **Metrics** | prom-client → Prometheus → Grafana | *Is* something wrong? (error rate, latency, traffic, saturation) |
| **Logs** | JSON logs → Promtail → Loki → Grafana | *What* went wrong? (error messages, order IDs) |
| **Traces** | OpenTelemetry → Jaeger | *Where* did the time go inside a request? |
