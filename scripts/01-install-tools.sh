#!/usr/bin/env bash
# Installs everything QuickBite needs on Ubuntu (WSL2).
# Assumes Docker is already installed and working (docker run hello-world).
# Safe to re-run: tools that are already installed are skipped.
set -euo pipefail

green() { echo -e "\n\033[1;32m==> $*\033[0m"; }
have()  { command -v "$1" >/dev/null 2>&1; }

green "Checking Docker"
if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running or your user is not in the docker group."
  echo "Fix:  sudo service docker start   and   sudo usermod -aG docker \$USER  (then close and reopen the terminal)"
  exit 1
fi

green "Base packages"
sudo apt-get update -y
sudo apt-get install -y curl wget git jq unzip gnupg ca-certificates apt-transport-https conntrack

green "Node.js 22 LTS"
if ! have node || (( $(node -v | sed 's/^v//; s/\..*//') < 22 )); then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v

green "Java 21 + Maven (for Jenkins and the menu-service)"
sudo apt-get install -y openjdk-21-jdk maven
java -version 2>&1 | head -1
mvn -v | head -1

green "kubectl"
if ! have kubectl; then
  KVER=$(curl -L -s https://dl.k8s.io/release/stable.txt)
  curl -LO "https://dl.k8s.io/release/${KVER}/bin/linux/amd64/kubectl"
  sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl && rm kubectl
fi
kubectl version --client

green "Minikube"
if ! have minikube; then
  curl -LO https://github.com/kubernetes/minikube/releases/latest/download/minikube-linux-amd64
  sudo install minikube-linux-amd64 /usr/local/bin/minikube && rm minikube-linux-amd64
fi
minikube version

green "Helm"
if ! have helm; then
  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
fi
helm version --short

green "Trivy (image vulnerability scanner)"
if ! have trivy; then
  wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | gpg --dearmor | sudo tee /usr/share/keyrings/trivy.gpg >/dev/null
  echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb generic main" | sudo tee /etc/apt/sources.list.d/trivy.list
  sudo apt-get update -y && sudo apt-get install -y trivy
fi
trivy --version | head -1

green "k6 (load testing)"
if ! have k6; then
  sudo gpg -k >/dev/null 2>&1 || true
  sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
       --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
  echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
  sudo apt-get update -y && sudo apt-get install -y k6
fi
k6 version

green "Jenkins (LTS war file)"
mkdir -p "$HOME/jenkins"
if [[ ! -f "$HOME/jenkins/jenkins.war" ]]; then
  wget -q --show-progress -O "$HOME/jenkins/jenkins.war" https://get.jenkins.io/war-stable/latest/jenkins.war
fi
ls -lh "$HOME/jenkins/jenkins.war"

green "Pre-pulling scanner images"
docker pull -q zricethezav/gitleaks:latest || true

green "All tools installed."
