#!/usr/bin/env bash
# Runs Jenkins as YOUR user so it can use your docker, kubectl, minikube and trivy directly.
# Jenkins UI: http://localhost:8090
set -euo pipefail

WAR="$HOME/jenkins/jenkins.war"
LOG="$HOME/jenkins/jenkins.log"
export JENKINS_HOME="$HOME/.jenkins-quickbite"

if [[ ! -f "$WAR" ]]; then
  echo "jenkins.war not found. Run ./scripts/01-install-tools.sh first."; exit 1
fi

if pgrep -f "httpPort=8090" >/dev/null; then
  echo "Jenkins is already running at http://localhost:8090"
else
  nohup java -jar "$WAR" --httpPort=8090 > "$LOG" 2>&1 &
  echo "Starting Jenkins (logs: $LOG) ..."
  for i in $(seq 1 60); do
    if curl -s -o /dev/null http://localhost:8090/login; then break; fi
    sleep 3
  done
  echo "Jenkins is up at http://localhost:8090"
fi

PW_FILE="$JENKINS_HOME/secrets/initialAdminPassword"
if [[ -f "$PW_FILE" ]]; then
  echo "Initial admin password: $(cat "$PW_FILE")"
fi
echo "Stop Jenkins later with:  pkill -f jenkins.war"
