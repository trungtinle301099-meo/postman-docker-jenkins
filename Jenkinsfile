pipeline {
    agent any

    triggers {
        cron('0 0,12 * * *')
    }

    environment {
        DOCKER_IMAGE_NAME = 'postman-newman-runner'
        CONTAINER_NAME = 'postman-newman-temp'
        HTML_REPORT_PATH = 'reports/html/*.html'
        JUNIT_REPORT_PATH = 'reports/junit/*.xml'
        JSON_REPORT_PATH = 'reports/json/*.json'
        EMAIL_REPORT_PATH = 'reports/email/email-report.html'
        EMAIL_TO = 'trungtinle301099@gmail.com'
    }

    options {
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Prepare Reports Folder') {
            steps {
                sh '''
                    rm -rf reports
                    mkdir -p reports/html reports/junit reports/json reports/email
                    docker rm -f ${CONTAINER_NAME} || true
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                sh '''
                    docker build --no-cache -t ${DOCKER_IMAGE_NAME} .
                '''
            }
        }

        stage('Run Postman Tests and Collect Reports') {
            steps {
                catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                    sh '''
                        docker rm -f ${CONTAINER_NAME} || true

                        mkdir -p reports/html reports/junit reports/json reports/email

                        echo "JOB_NAME=${JOB_NAME}" > reports/jenkins-build.env
                        echo "BUILD_NUMBER=${BUILD_NUMBER}" >> reports/jenkins-build.env
                        echo "BUILD_URL=${BUILD_URL}" >> reports/jenkins-build.env
                        echo "GIT_COMMIT=${GIT_COMMIT}" >> reports/jenkins-build.env
                        echo "BRANCH_NAME=main" >> reports/jenkins-build.env

                        echo "===== JENKINS BUILD ENV FILE ====="
                        cat reports/jenkins-build.env

                        docker create --name ${CONTAINER_NAME} \
                            --env-file reports/jenkins-build.env \
                            ${DOCKER_IMAGE_NAME} \
                            sh -c 'npm run test:postman; TEST_EXIT=$?; if [ "$TEST_EXIT" -eq 0 ]; then export BUILD_STATUS="SUCCESS"; else export BUILD_STATUS="FAILURE"; fi; echo "===== ENV INSIDE DOCKER ====="; printenv | grep -E "JOB_NAME|BUILD_NUMBER|BUILD_URL|GIT_COMMIT|BRANCH_NAME|BUILD_STATUS"; node scripts/generate-email-report.js || true; exit $TEST_EXIT'

                        set +e
                        docker start -a ${CONTAINER_NAME}
                        TEST_EXIT=$?
                        set -e

                        mkdir -p reports/html reports/junit reports/json reports/email

                        echo "===== COPY REPORTS FROM DOCKER CONTAINER TO JENKINS WORKSPACE ====="
                        docker cp ${CONTAINER_NAME}:/app/reports/. reports/ || true

                        echo "===== REPORTS GENERATED IN JENKINS WORKSPACE ====="
                        find reports -maxdepth 3 -type f | sort || true

                        docker rm -f ${CONTAINER_NAME} || true

                        exit $TEST_EXIT
                    '''
                }
            }
        }
    }

    post {
        always {
            echo 'Checking generated report files...'

            sh '''
                echo "===== REPORTS TREE ====="
                find reports -maxdepth 3 -type f | sort || true

                echo "===== EMAIL REPORT FOLDER ====="
                ls -la reports/email || true
            '''

            echo 'Publishing JUnit report...'
            junit allowEmptyResults: true, testResults: "${JUNIT_REPORT_PATH}"

            echo 'Archiving reports...'
            archiveArtifacts artifacts: 'reports/**/*', allowEmptyArchive: true, fingerprint: true

            echo 'Sending professional email report...'
            script {
                def emailBody = fileExists("${EMAIL_REPORT_PATH}")
                    ? readFile("${EMAIL_REPORT_PATH}")
                    : """
                        <h2>Postman API Automation Test Report</h2>
                        <p><b>Status:</b> ${currentBuild.currentResult}</p>
                        <p><b>Error:</b> Email report file was not generated.</p>
                        <p>Please check Jenkins console log and Newman JSON report.</p>
                      """

                emailext(
                    subject: "[Postman API Test Report] ${currentBuild.currentResult} - ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                    mimeType: 'text/html',
                    to: "${EMAIL_TO}",
                    attachLog: true,
                    attachmentsPattern: 'reports/**/*.html',
                    body: emailBody
                )
            }
        }

        cleanup {
            echo 'Cleaning Docker resources...'

            sh '''
                docker rm -f ${CONTAINER_NAME} || true
                docker image prune -f || true
            '''
        }
    }
}
