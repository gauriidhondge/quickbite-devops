#!/usr/bin/env bash
# Fault injection for the SRE incident demo.
#   ./scripts/chaos.sh break   -> slow (600 ms) and failing (15%) order API
#   ./scripts/chaos.sh heal    -> back to normal
#   ./scripts/chaos.sh status  -> show current values
set -euo pipefail

NS=quickbite
case "${1:-status}" in
  break)
    DELAY="${2:-600}"; RATE="${3:-0.15}"
    echo "Injecting fault: CHAOS_DELAY_MS=$DELAY CHAOS_ERROR_RATE=$RATE  ($(date +%T))"
    kubectl -n $NS patch configmap quickbite-config --type merge \
      -p "{\"data\":{\"CHAOS_DELAY_MS\":\"$DELAY\",\"CHAOS_ERROR_RATE\":\"$RATE\"}}"
    kubectl -n $NS rollout restart deployment/quickbite
    kubectl -n $NS rollout status deployment/quickbite --timeout=120s
    ;;
  heal)
    echo "Removing fault  ($(date +%T))"
    kubectl -n $NS patch configmap quickbite-config --type merge \
      -p '{"data":{"CHAOS_DELAY_MS":"0","CHAOS_ERROR_RATE":"0"}}'
    kubectl -n $NS rollout restart deployment/quickbite
    kubectl -n $NS rollout status deployment/quickbite --timeout=120s
    ;;
  status)
    kubectl -n $NS get configmap quickbite-config -o jsonpath='{.data}' ; echo
    ;;
  *)
    echo "Usage: $0 break [delay_ms] [error_rate] | heal | status"; exit 1
    ;;
esac
