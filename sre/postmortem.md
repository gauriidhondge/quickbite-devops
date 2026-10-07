# Post-mortem: Lunch-Rush Order Failures (QB-INC-001)

> **Blameless:** this document focuses on *what* in the system allowed the failure,
> not *who* made a mistake.
> Replace the times and numbers below with the real values from your demo run.

| Field | Value |
|---|---|
| Incident ID | QB-INC-001 |
| Date | DD-MM-2026 |
| Severity | SEV-1 (critical user journey broken during peak) |
| Duration | 13:02 - 13:11 IST (≈ 9 minutes) |
| Incident Commander | <name> |
| Status | Resolved |

## 1. Summary
During the simulated 1 pm lunch rush, a configuration change made the order service add ~600 ms
of delay and fail ~15% of `POST /api/orders` requests. The SLO alerts fired within 2 minutes.
The change was reverted and the service fully recovered 9 minutes after the start.

## 2. Impact
- ~15% of order attempts failed with HTTP 500 during the incident window.
- p95 order latency rose from ~20 ms to ~650 ms (SLO: 300 ms).
- Error budget consumed: about **X%** of the monthly budget (read from the Grafana "Error budget remaining" panel).
- SLA (99.0% monthly) was **not** breached.

## 3. Timeline (IST)
| Time | Event |
|---|---|
| 13:00 | Lunch-rush load (k6, 50 virtual users) starts; all SLIs green |
| 13:02 | Faulty config rolled out (`CHAOS_DELAY_MS=600`, `CHAOS_ERROR_RATE=0.15`) |
| 13:03 | Grafana shows error ratio rising above 2% and p95 above 300 ms |
| 13:04 | `QuickBiteHighErrorRate` and `QuickBiteHighLatency` alerts **firing** |
| 13:05 | On-call acknowledges; checks Loki error logs, sees "Kitchen system unavailable" |
| 13:07 | Jaeger traces confirm ~600 ms spent in the order handler; root cause = config change |
| 13:08 | Mitigation: config reverted (`scripts/chaos.sh heal`), pods restarted |
| 13:11 | Error ratio back to 0%, p95 back under 50 ms; alerts resolved |

## 4. Root cause
A runtime configuration change was applied directly to the cluster without passing through
the CI/CD pipeline. The pipeline's tests and canary step were therefore skipped, and the
faulty config reached 100% of pods at the busiest time of day.

## 5. What went well
- SLO-based alerts detected the problem within ~2 minutes, before students reported it.
- The three pillars worked together: **metrics** showed *that* it broke, **logs** showed *what*, **traces** showed *where*.
- Rollback was a single command because previous revisions are kept (`revisionHistoryLimit: 10`).

## 6. What went wrong
- Config changes bypassed the pipeline (no review, no canary).
- The change was made during peak hours.
- There was no automatic rollback on SLO breach.

## 7. Action items
| # | Action | Type | Owner | Due |
|---|---|---|---|---|
| 1 | Manage ConfigMap changes through Git + pipeline only (GitOps) | Prevent | <name> | +1 week |
| 2 | Add a change-freeze window 12:30-14:00 on weekdays | Prevent | <name> | +1 week |
| 3 | Route every release through the canary deployment first | Detect earlier | <name> | +2 weeks |
| 4 | Automatically roll back when `QuickBiteErrorBudgetFastBurn` fires | Mitigate faster | <name> | +3 weeks |

## 8. Lessons learned
Fast detection came from measuring what students experience (SLIs), not just CPU or memory.
Reliability work should focus on making risky changes safe, not on avoiding change altogether.
