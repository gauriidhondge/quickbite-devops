#!/usr/bin/env bash
# Manual first deployment (before Jenkins is set up). Jenkins does the same thing automatically.
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE="quickbite:1.0.0"

echo "==> Building image $IMAGE"
docker build --build-arg APP_VERSION=1.0.0 -t "$IMAGE" -t quickbite:latest app

echo "==> Loading image into Minikube"
minikube image load "$IMAGE"

echo "==> Applying Kubernetes manifests"
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml -f k8s/service.yaml -f k8s/hpa.yaml
sed "s|image: quickbite:latest|image: $IMAGE|" k8s/deployment.yaml | kubectl apply -f -
kubectl -n quickbite annotate deployment/quickbite kubernetes.io/change-cause="manual first deploy $IMAGE" --overwrite
kubectl -n quickbite rollout status deployment/quickbite --timeout=180s

echo "==> Registering with Prometheus (ServiceMonitor + SLO alert rules)"
kubectl apply -f monitoring/servicemonitor.yaml -f monitoring/prometheus-rules.yaml

kubectl -n quickbite get pods,svc,hpa
echo
echo "App is reachable inside WSL at: http://$(minikube ip):30080"
echo "For your Windows browser run:   ./scripts/port-forward.sh   then open http://localhost:8080"
