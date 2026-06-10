pipeline {
    agent any

    triggers {
        cron('0 7,19 * * *')
    }

    environment {
        DOCKER_IMAGE_NAME = 'postman-newman-runner'
        HTML_REPORT_PATH = 'reports/html/create-booking-api-report.html'
        JUNIT_REPORT_PATH = 'reports/junit/create-booking-api-junit.xml'
        JSON_REPORT_PATH = 'reports/json/newman-report.json'
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
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                sh '''
                    docker build -t ${DOCKER_IMAGE_NAME} .
                '''
            }
        }

        stage('Run Postman Tests with Newman') {
            steps {
                catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                    sh '''
                        docker run --rm -v "$PWD/reports:/app/reports" ${DOCKER_IMAGE_NAME}
                    '''
                }
            }
        }
    }

    post {
        always {
            echo 'Generating professional email report...'

            script {
                env.BUILD_STATUS_TEXT = currentBuild.currentResult ?: 'SUCCESS'
            }

            sh '''
                docker run --rm \
                  -v "$PWD/reports:/app/reports" \
                  -e JOB_NAME="${JOB_NAME}" \
                  -e BUILD_NUMBER="${BUILD_NUMBER}" \
                  -e BUILD_URL="${BUILD_URL}" \
                  -e GIT_COMMIT="${GIT_COMMIT}" \
                  -e BRANCH_NAME="${BRANCH_NAME}" \
                  -e BUILD_STATUS="${BUILD_STATUS_TEXT}" \
                  ${DOCKER_IMAGE_NAME} node scripts/generate-email-report.js || true
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
                        <p>Email report file was not generated. Please check Jenkins console log.</p>
                      """

                emailext(
                    subject: "[Postman API Test Report] ${currentBuild.currentResult} - ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                    mimeType: 'text/html',
                    to: "${EMAIL_TO}",
                    attachLog: true,
                    attachmentsPattern: 'reports/html/*.html',
                    body: emailBody
                )
            }
        }

        cleanup {
            echo 'Cleaning unused Docker image...'
            sh '''
                docker image prune -f || true
            '''
        }
    }
}
