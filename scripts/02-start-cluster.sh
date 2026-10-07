#!/usr/bin/env bash
# Starts a single-node Kubernetes cluster with Minikube (Docker driver).
# Override resources if your laptop is small:  MK_MEMORY=4096 MK_CPUS=2 ./scripts/02-start-cluster.sh
set -euo pipefail

MK_CPUS="${MK_CPUS:-4}"
MK_MEMORY="${MK_MEMORY:-6144}"

if minikube status >/dev/null 2>&1; then
  echo "Minikube is already running."
else
  minikube start --driver=docker --cpus="$MK_CPUS" --memory="$MK_MEMORY"
fi

# metrics-server is required by the HorizontalPodAutoscaler
minikube addons enable metrics-server

kubectl get nodes -o wide
echo
echo "Cluster ready. Minikube IP: $(minikube ip)"
