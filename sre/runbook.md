# QuickBite On-call Runbook

## First 5 minutes (any alert)
1. Acknowledge the alert in Alertmanager (http://localhost:9093) so others know you are on it.
2. Open Grafana → **QuickBite - SRE Overview** dashboard.
3. Check what changed recently:
   `kubectl -n quickbite rollout history deployment/quickbite`
4. Post in the team channel: *"Investigating <alert>, IC = <your name>"*.

## QuickBiteDown
- `kubectl -n quickbite get pods` - are pods CrashLooping or Pending?
- `kubectl -n quickbite describe pod <pod>` - look at Events (image pull errors, OOMKilled, probe failures).
- `kubectl -n quickbite logs <pod> --previous` - logs from the crashed container.
- **Mitigate:** `kubectl -n quickbite rollout undo deployment/quickbite`

## QuickBiteHighErrorRate
- Grafana → "Error logs only" panel (Loki) or Explore: `{namespace="quickbite"} | json | level="error"`
- Check whether errors come only from the canary: "Requests by track" panel.
- Check the config: `kubectl -n quickbite get configmap quickbite-config -o yaml` (CHAOS_ERROR_RATE should be "0").
- **Mitigate:** roll back the last release, or delete the canary deployment.

## QuickBiteHighLatency
- Jaeger UI (http://localhost:16686) → service `quickbite` → sort by duration; find the slow span.
- Check saturation: "CPU per pod" panel and `kubectl -n quickbite get hpa`.
- **Mitigate:** scale out `kubectl -n quickbite scale deployment/quickbite --replicas=5`, or roll back.

## QuickBiteErrorBudgetFastBurn
- Treat as a SEV-1 incident: assign an Incident Commander, start the incident timeline.
- Apply the mitigation above, then follow the error-budget policy in `SLO.md`.
- A post-mortem is **mandatory** (template: `postmortem.md`).
