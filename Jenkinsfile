pipeline {
    agent any

    triggers {
        cron('0 7,19 * * *')
    }

    environment {
        DOCKER_IMAGE_NAME = 'postman-newman-runner'
        HTML_REPORT_PATH = 'reports/html/create-booking-api-report.html'
        JUNIT_REPORT_PATH = 'reports/junit/create-booking-api-junit.xml'
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
                    mkdir -p reports/html reports/junit
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
            echo 'Publishing JUnit report...'
            junit allowEmptyResults: true, testResults: "${JUNIT_REPORT_PATH}"

            echo 'Archiving HTML and JUnit reports...'
            archiveArtifacts artifacts: 'reports/**/*', allowEmptyArchive: true, fingerprint: true

            echo 'Sending email report...'
            emailext(
                subject: "[Postman API Test] ${currentBuild.currentResult} - ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                mimeType: 'text/html',
                to: "${EMAIL_TO}",
                attachLog: true,
                attachmentsPattern: 'reports/html/*.html',
                body: """
                    <h2>Postman API Test Report</h2>

                    <p><b>Status:</b> ${currentBuild.currentResult}</p>
                    <p><b>Job:</b> ${env.JOB_NAME}</p>
                    <p><b>Build Number:</b> #${env.BUILD_NUMBER}</p>
                    <p><b>Build URL:</b> <a href="${env.BUILD_URL}">${env.BUILD_URL}</a></p>

                    <hr/>

                    <p><b>Collection:</b> Create booking API</p>
                    <p><b>Schedule:</b> 07:00 and 19:00 Asia/Ho_Chi_Minh</p>
                    <p><b>HTML Report:</b> Attached in this email and archived in Jenkins artifacts.</p>
                    <p><b>JUnit Report:</b> Published in Jenkins Test Result.</p>

                    <hr/>

                    <p>
                        If the test failed, please open the attached HTML report or Jenkins console log
                        to check failed request, assertion error, status code, or response body.
                    </p>
                """
            )
        }

        cleanup {
            echo 'Cleaning unused Docker image...'
            sh '''
                docker image prune -f || true
            '''
        }
    }
}
