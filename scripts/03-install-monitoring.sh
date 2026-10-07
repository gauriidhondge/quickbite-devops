#!/usr/bin/env bash
# Installs the observability stack into the cluster:
#   Metrics : Prometheus + Alertmanager + Grafana (kube-prometheus-stack)
#   Logs    : Loki + Promtail (loki-stack)
#   Traces  : Jaeger (all-in-one)
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Adding Helm repositories"
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null 2>&1 || true
helm repo add grafana https://grafana.github.io/helm-charts >/dev/null 2>&1 || true
helm repo update

echo "==> Installing kube-prometheus-stack (this takes 3-5 minutes the first time)"
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  -f monitoring/kube-prometheus-values.yaml \
  --wait --timeout 10m

echo "==> Installing Loki + Promtail"
helm upgrade --install loki grafana/loki-stack \
  --namespace monitoring \
  -f monitoring/loki-values.yaml \
  --wait --timeout 10m

echo "==> Installing Jaeger"
kubectl apply -f monitoring/jaeger.yaml
kubectl -n observability rollout status deployment/jaeger --timeout=300s

echo "==> Loading the QuickBite Grafana dashboard"
kubectl apply -f monitoring/grafana-dashboard-configmap.yaml

# Restart Grafana so it picks up the Loki datasource
kubectl -n monitoring rollout restart deployment/monitoring-grafana
kubectl -n monitoring rollout status deployment/monitoring-grafana --timeout=300s

echo
kubectl get pods -n monitoring
kubectl get pods -n observability
echo
echo "Monitoring stack ready. Grafana login: admin / quickbite123"
