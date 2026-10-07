# Incident Simulation Script (for the FA2 demo)

Goal: show the full SRE loop: **load → fault → detect → alert → mitigate → post-mortem**.
Keep these open side by side: Grafana dashboard, Alertmanager / Prometheus Alerts page, Jaeger, a terminal.

## Step 1 - Normal lunch rush (baseline)
```bash
# Hit the NodePort directly so traffic is spread over ALL pods (port-forward pins to one pod)
k6 run -e BASE_URL=http://$(minikube ip):30080 load-test/k6-lunch-rush.js
```
Show: availability ~100%, p95 well below 300 ms, HPA adding pods as CPU rises, k6 thresholds ✓.

## Step 2 - Inject the fault (a "bad release" that slows down and breaks the kitchen API)
Start the load test again in one terminal, then in another:
```bash
./scripts/chaos.sh break             # sets CHAOS_DELAY_MS=600, CHAOS_ERROR_RATE=0.15 and restarts pods
```

## Step 3 - Detect
Within ~2 minutes:
- Grafana: Availability turns red, p95 latency goes above the 300 ms line, error budget drops.
- Prometheus → Alerts: `QuickBiteHighErrorRate` and `QuickBiteHighLatency` go **Pending → Firing**.
- Loki "Error logs only" panel shows `Injected failure on order placement`.
- Jaeger: traces for `POST /api/orders` now take ~600 ms.
- k6 ends with ✗ on its SLO thresholds.

## Step 4 - Mitigate
```bash
./scripts/chaos.sh heal              # restore config and restart pods
# OR, if the fault came from a new image:
kubectl -n quickbite rollout undo deployment/quickbite
```
Show alerts resolving and graphs returning to green.

## Step 5 - Post-mortem
Fill in `sre/postmortem.md` with **your real timestamps and screenshots** from the demo.
