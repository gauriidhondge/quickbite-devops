// =====================================================================
// QuickBite CI/CD Pipeline (Pipeline as Code)
// Source -> Build -> Lint -> Unit Test -> DevSecOps scans -> Containerize
//        -> Image scan -> Deploy to Kubernetes (rolling update)
//        -> Smoke test -> Auto-rollback on failure
// Runs on a Jenkins controller on Ubuntu WSL that has docker, kubectl,
// minikube and trivy on its PATH (see README / scripts/).
// =====================================================================
pipeline {
    agent any

    parameters {
        booleanParam(name: 'PUSH_TO_DOCKERHUB', defaultValue: false,
                     description: 'Also push image to Docker Hub (needs credentials id "dockerhub-creds")')
        string(name: 'DOCKERHUB_USER', defaultValue: '', description: 'Docker Hub username (only if pushing)')
        booleanParam(name: 'BUILD_MAVEN_SERVICE', defaultValue: true,
                     description: 'Also build the Java menu-service with Maven')
    }

    environment {
        APP_NAME   = 'quickbite'
        NAMESPACE  = 'quickbite'
        IMAGE_TAG  = "1.0.${BUILD_NUMBER}"
        IMAGE      = "quickbite:1.0.${BUILD_NUMBER}"
    }

    options {
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '15'))
        disableConcurrentBuilds()
    }

    triggers {
        // WSL is not reachable by GitHub webhooks, so poll the repo every 2 minutes
        pollSCM('H/2 * * * *')
    }

    stages {

        stage('1. Source') {
            steps {
                checkout scm
                sh 'git log -1 --pretty=format:"Commit %h by %an: %s"'
            }
        }

        stage('2. Build (install deps)') {
            steps {
                dir('app') {
                    sh 'node --version && npm --version'
                    sh 'npm ci'
                }
            }
        }

        stage('3. Lint') {
            steps {
                dir('app') { sh 'npm run lint' }
            }
        }

        stage('4. Unit Tests + Coverage') {
            steps {
                dir('app') { sh 'npm test' }
            }
            post {
                always {
                    // Publish coverage report as a build artifact
                    archiveArtifacts artifacts: 'app/coverage/**', allowEmptyArchive: true
                }
            }
        }

        stage('5. Maven Build (menu-service)') {
            when { expression { params.BUILD_MAVEN_SERVICE } }
            steps {
                dir('menu-service') {
                    sh 'mvn -B clean package'
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: 'menu-service/target/*.jar, menu-service/target/surefire-reports/*.txt',
                                     allowEmptyArchive: true
                }
            }
        }

        stage('6. DevSecOps: Dependency & Secret Scan') {
            parallel {
                stage('npm audit') {
                    steps {
                        dir('app') { sh 'npm audit --omit=dev --audit-level=high' }
                    }
                }
                stage('Gitleaks secret scan') {
                    steps {
                        sh '''
                          docker run --rm -v "$WORKSPACE:/repo" zricethezav/gitleaks:latest \
                            detect --source=/repo --no-git --redact -v --exit-code 1
                        '''
                    }
                }
            }
        }

        stage('7. Containerize (Docker build)') {
            steps {
                dir('app') {
                    sh "docker build --build-arg APP_VERSION=${IMAGE_TAG} -t ${IMAGE} -t ${APP_NAME}:latest ."
                }
            }
        }

        stage('8. DevSecOps: Image Scan (Trivy)') {
            steps {
                // Fail the build on CRITICAL vulnerabilities that have a fix available
                sh "trivy image --severity CRITICAL --ignore-unfixed --exit-code 1 --no-progress ${IMAGE}"
                sh "trivy image --severity HIGH,CRITICAL --format table --output trivy-report.txt ${IMAGE} || true"
            }
            post {
                always { archiveArtifacts artifacts: 'trivy-report.txt', allowEmptyArchive: true }
            }
        }

        stage('9. Publish Image') {
            steps {
                // Make the image available inside the Minikube cluster
                sh "minikube image load ${IMAGE}"
                script {
                    if (params.PUSH_TO_DOCKERHUB && params.DOCKERHUB_USER?.trim()) {
                        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds',
                                usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
                            sh '''
                              echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin
                              docker tag $IMAGE $DH_USER/$IMAGE
                              docker push $DH_USER/$IMAGE
                            '''
                        }
                    }
                }
            }
        }

        stage('10. Deploy to Kubernetes (Rolling Update)') {
            steps {
                script { env.DEPLOY_STARTED = 'true' }
                sh '''
                  kubectl apply -f k8s/namespace.yaml
                  kubectl apply -f k8s/configmap.yaml -f k8s/service.yaml -f k8s/hpa.yaml
                  # Inject the freshly built image tag into the manifest and apply (one rollout)
                  sed "s|image: quickbite:latest|image: $IMAGE|" k8s/deployment.yaml | kubectl apply -f -
                  kubectl -n $NAMESPACE annotate deployment/$APP_NAME \
                      kubernetes.io/change-cause="Jenkins build #$BUILD_NUMBER image $IMAGE" --overwrite
                  kubectl -n $NAMESPACE rollout status deployment/$APP_NAME --timeout=180s
                '''
            }
        }

        stage('11. Smoke Test') {
            steps {
                sh '''
                  kubectl -n $NAMESPACE run smoke-$BUILD_NUMBER --rm -i --restart=Never \
                    --image=curlimages/curl:8.10.1 -- \
                    sh -c "curl -sf http://quickbite/health && curl -sf http://quickbite/api/menu > /dev/null && echo SMOKE_OK"
                '''
            }
        }

        stage('12. Monitoring hook') {
            steps {
                // Monitoring is already running in-cluster (Prometheus scrapes /metrics via ServiceMonitor).
                // Here we just confirm the new pods expose metrics.
                sh '''
                  POD=$(kubectl -n $NAMESPACE get pod -l app=quickbite -o jsonpath="{.items[0].metadata.name}")
                  kubectl -n $NAMESPACE exec $POD -- wget -qO- http://localhost:3000/metrics | grep -m3 http_requests_total || true
                  kubectl apply -f monitoring/servicemonitor.yaml -f monitoring/prometheus-rules.yaml || echo "Monitoring stack not installed yet"
                '''
            }
        }
    }

    post {
        failure {
            script {
                if (env.DEPLOY_STARTED == 'true') {
                    echo 'Deployment or smoke test failed - rolling back to the previous revision'
                    sh 'kubectl -n $NAMESPACE rollout undo deployment/$APP_NAME || true'
                    sh 'kubectl -n $NAMESPACE rollout status deployment/$APP_NAME --timeout=120s || true'
                } else {
                    echo 'Pipeline failed before deployment - production was not touched'
                }
            }
        }
        success {
            echo "Deployed ${IMAGE} successfully"
            sh 'kubectl -n $NAMESPACE rollout history deployment/$APP_NAME | tail -5'
        }
    }
}
