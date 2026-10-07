#!/usr/bin/env bash
# Stops everything. Use "--delete" to also delete the Minikube cluster.
set -uo pipefail
pkill -f "kubectl.*port-forward" 2>/dev/null
pkill -f "httpPort=8090" 2>/dev/null && echo "Jenkins stopped"
if [[ "${1:-}" == "--delete" ]]; then
  minikube delete
else
  minikube stop
fi
