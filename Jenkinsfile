// Jenkins Declarative Pipeline for the Task Manager Python CI project.
//
// Stages: Checkout -> Install Dependencies -> Run Tests -> Archive Test Results -> Deploy
//
// Prerequisites on the Jenkins agent:
//   - Python 3.10+ installed and available as 'python3' or 'python'
//   - Git plugin enabled (for checkout scm)
//   - JUnit plugin enabled (for test report publishing)

pipeline {
    agent any

    // Environment variables shared across all stages.
    environment {
        PYTHONPATH = "${WORKSPACE}/src"
        TEST_RESULTS_DIR = 'test-results'
    }

    options {
        // Keep only the last 10 builds to conserve disk space.
        buildDiscarder(logRotator(numToKeepStr: '10'))
        // Fail fast if a stage exceeds 10 minutes.
        timeout(time: 10, unit: 'MINUTES')
        // Add timestamps to console output for easier debugging.
        timestamps()
    }

    stages {

        // ── Stage 1: Checkout ──────────────────────────────────────────────
        stage('Checkout') {
            steps {
                echo 'Checking out source code from SCM...'
                checkout scm
                sh '''
                    echo "Repository checked out to: ${WORKSPACE}"
                    echo "Git commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'N/A')"
                    ls -la
                '''
            }
        }

        // ── Stage 2: Install Dependencies ──────────────────────────────────
        stage('Install Dependencies') {
            steps {
                echo 'Creating virtual environment and installing Python packages...'
                sh '''
                    python3 -m venv .venv || python -m venv .venv
                    . .venv/bin/activate
                    pip install --upgrade pip
                    pip install -r requirements.txt
                    echo "Installed packages:"
                    pip list
                '''
            }
        }

        // ── Stage 3: Run Tests ─────────────────────────────────────────────
        stage('Run Tests') {
            steps {
                echo 'Executing pytest with JUnit XML and coverage reports...'
                sh '''
                    . .venv/bin/activate
                    mkdir -p ${TEST_RESULTS_DIR}
                    pytest --junitxml=${TEST_RESULTS_DIR}/junit-report.xml \
                           --cov=calculator \
                           --cov-report=xml:${TEST_RESULTS_DIR}/coverage.xml \
                           --cov-report=html:${TEST_RESULTS_DIR}/coverage-html \
                           --cov-report=term-missing
                '''
            }
        }

        // ── Stage 4: Archive Test Results ──────────────────────────────────
        stage('Archive Test Results') {
            steps {
                echo 'Publishing test reports and archiving artifacts...'
                // Publish JUnit results — Jenkins displays pass/fail trends in the UI.
                junit testResults: "${TEST_RESULTS_DIR}/junit-report.xml",
                      allowEmptyResults: false,
                      skipPublishingChecks: false

                // Archive HTML coverage report and raw XML for download.
                archiveArtifacts artifacts: "${TEST_RESULTS_DIR}/**/*",
                                 allowEmptyArchive: false,
                                 fingerprint: true
            }
        }

        // ── Stage 5: Deploy (CD) ───────────────────────────────────────────
        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                echo 'Continuous Deployment — publishing build artifacts...'
                sh '''
                    mkdir -p deploy
                    cp -r src deploy/
                    cat > deploy/DEPLOYED.txt << EOF
Deployed: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Commit:   $(git rev-parse --short HEAD)
Branch:   ${BRANCH_NAME:-main}
Build:    ${BUILD_NUMBER}
EOF
                    echo "Deployment complete."
                    cat deploy/DEPLOYED.txt
                '''
                archiveArtifacts artifacts: 'deploy/**/*',
                                 allowEmptyArchive: true,
                                 fingerprint: true
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully — all tests passed and deployed.'
        }
        failure {
            echo 'Pipeline failed — check the console log and test report for details.'
        }
        always {
            // Clean up the virtual environment to free agent disk space.
            sh 'rm -rf .venv || true'
        }
    }
}
