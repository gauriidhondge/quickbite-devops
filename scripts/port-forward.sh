#!/usr/bin/env bash
# Opens all UIs on localhost so you can use them from your Windows browser.
# Press Ctrl+C to stop all port-forwards.
set -uo pipefail

forward() {  # namespace service localPort:remotePort
  while true; do
    kubectl -n "$1" port-forward "svc/$2" "$3" >/dev/null 2>&1
    sleep 2   # restart automatically if the pod restarts
  done &
}

forward quickbite     quickbite                               8081:80
forward monitoring    monitoring-grafana                      3000:80
forward monitoring    monitoring-kube-prometheus-prometheus   9090:9090
forward monitoring    monitoring-kube-prometheus-alertmanager 9093:9093
forward observability jaeger                                  16686:16686

trap 'echo; echo "Stopping port-forwards"; kill $(jobs -p) 2>/dev/null; pkill -f "kubectl.*port-forward" ; exit 0' INT TERM

cat <<EOF

  QuickBite app  : http://localhost:8081
  Grafana        : http://localhost:3000   (admin / quickbite123)
  Prometheus     : http://localhost:9090
  Alertmanager   : http://localhost:9093
  Jaeger         : http://localhost:16686
  Jenkins        : http://localhost:8090   (started separately)

  Press Ctrl+C to stop.
EOF
wait
