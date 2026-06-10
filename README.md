````markdown
# Postman Docker Jenkins Automation

## Overview

`postman-docker-jenkins` is an API automation project designed to run Postman Collections using Newman, Docker, and Jenkins.

The main purpose of this project is to:

- Execute Postman API test collections from source code.
- Run tests locally through npm scripts.
- Run tests inside Docker for consistent execution.
- Run scheduled API automation jobs in Jenkins.
- Generate test reports in multiple formats:
  - Newman CLI output
  - HTML report
  - JUnit XML report
  - JSON report
  - HTML email report for Jenkins email notification

The current collection targets the Restful Booker API and executes a create booking scenario.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Runtime used to install and run Newman |
| npm | Package manager used by the project |
| Postman Collection | Stores API requests, test scripts, variables, and assertions |
| Newman | CLI tool used to run Postman collections |
| newman-reporter-htmlextra | Generates detailed Newman HTML reports |
| Shell Script | Runs all collections against all environments |
| JavaScript | Generates the Jenkins email report from Newman JSON output |
| Docker | Runs Newman tests inside an isolated container |
| Docker Compose | Runs Jenkins locally with Docker support |
| Jenkins | CI/CD automation server for scheduled test execution |
| JUnit Report | Allows Jenkins to publish test results |
| HTML Report | Provides readable test execution evidence |

---

## Project Structure

```text
postman-docker-jenkins/
├── collections/
│   └── create-booking-api.postman_collection.json
├── environments/
│   └── Dev.postman_environment.json
├── jenkins/
│   └── Dockerfile
├── scripts/
│   ├── generate-email-report.js
│   └── run-all-collections.sh
├── .dockerignore
├── .gitignore
├── Dockerfile
├── Jenkinsfile
├── README.md
├── docker-compose.jenkins.yml
├── package-lock.json
└── package.json
````

### Folder and File Explanation

| Path                                                     | Purpose                                                                                                                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collections/`                                           | Stores Postman collection files. Each file must follow the `*.postman_collection.json` naming convention so the runner script can detect it automatically. |
| `collections/create-booking-api.postman_collection.json` | Current Postman collection. It contains the create booking API request and Postman test assertions.                                                        |
| `environments/`                                          | Stores Postman environment files. Each file must follow the `*.postman_environment.json` naming convention.                                                |
| `environments/Dev.postman_environment.json`              | Current Dev environment. It contains the API base URL and token variable.                                                                                  |
| `scripts/run-all-collections.sh`                         | Main test runner script. It runs every Postman collection against every Postman environment and generates reports.                                         |
| `scripts/generate-email-report.js`                       | Reads Newman JSON reports and generates an HTML email report for Jenkins.                                                                                  |
| `Dockerfile`                                             | Docker image for running Newman tests inside a Node.js 20 Alpine container.                                                                                |
| `jenkins/Dockerfile`                                     | Custom Jenkins image with Docker CLI installed. This allows Jenkins to build and run Docker containers.                                                    |
| `docker-compose.jenkins.yml`                             | Docker Compose file used to start Jenkins locally. It exposes Jenkins on port `8090`.                                                                      |
| `Jenkinsfile`                                            | Jenkins Pipeline definition. It builds the Docker image, runs API tests, archives reports, publishes JUnit results, and sends email.                       |
| `package.json`                                           | Defines project metadata, npm scripts, and Newman dependencies.                                                                                            |
| `package-lock.json`                                      | Locks installed npm dependency versions.                                                                                                                   |
| `.gitignore`                                             | Excludes local dependencies, reports, logs, `.env`, and OS files from Git.                                                                                 |
| `.dockerignore`                                          | Excludes unnecessary files from Docker build context.                                                                                                      |

---

## Prerequisites

Before running this project, install the following tools.

### Required for local execution

| Tool    | Required | Notes                                                                         |
| ------- | -------- | ----------------------------------------------------------------------------- |
| Node.js | Yes      | Recommended: Node.js 20 because the project Dockerfile uses `node:20-alpine`. |
| npm     | Yes      | Required to install dependencies and run scripts.                             |
| Git     | Yes      | Required to clone the repository.                                             |

### Required for Docker execution

| Tool   | Required | Notes                                                |
| ------ | -------- | ---------------------------------------------------- |
| Docker | Yes      | Required to build and run the Newman test container. |

### Required for Jenkins execution

| Tool                           | Required | Notes                                                                     |
| ------------------------------ | -------- | ------------------------------------------------------------------------- |
| Docker                         | Yes      | Jenkins runs the API test job through Docker.                             |
| Docker Compose                 | Yes      | Required if you want to start Jenkins using `docker-compose.jenkins.yml`. |
| Jenkins                        | Yes      | Can be started from this repository using Docker Compose.                 |
| Jenkins Email Extension Plugin | Yes      | Required because `Jenkinsfile` uses `emailext`.                           |
| Jenkins JUnit Plugin           | Yes      | Required because `Jenkinsfile` publishes JUnit XML reports.               |

---

## Installation

Clone the repository:

```bash
git clone https://github.com/trungtinle301099-meo/postman-docker-jenkins.git
cd postman-docker-jenkins
```

Install dependencies:

```bash
npm install
```

For clean CI-style installation, use:

```bash
npm ci
```

`npm ci` is recommended in Docker/CI because the repository contains `package-lock.json`.

---

## Environment Configuration

The current Postman environment file is:

```text
environments/Dev.postman_environment.json
```

Current environment variables:

| Variable | Current Value                          | Purpose                                                       |
| -------- | -------------------------------------- | ------------------------------------------------------------- |
| `URL`    | `https://restful-booker.herokuapp.com` | Base URL used by Postman requests.                            |
| `token`  | Empty by default                       | Token variable reserved for authenticated requests if needed. |

Example request URL inside the collection:

```text
{{URL}}/booking
```

This means Newman will replace `{{URL}}` using the value from the selected Postman environment file.

### Important Notes

* The current source does not include a `.env.example` file.
* Environment values are stored inside Postman environment JSON files.
* If you add another environment, place it inside `environments/` and use this naming format:

```text
<EnvironmentName>.postman_environment.json
```

Example:

```text
environments/Staging.postman_environment.json
environments/Production.postman_environment.json
```

---

## Available Scripts

The project currently defines these npm scripts:

| Script                | Command                                                                                                                                                                                                                                                                                                                                        | Description                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `test:postman`        | `sh scripts/run-all-collections.sh`                                                                                                                                                                                                                                                                                                            | Runs all Postman collections in `collections/` against all environments in `environments/`.                         |
| `test:postman:single` | `newman run collections/create-booking-api.postman_collection.json -e environments/Dev.postman_environment.json -r cli,htmlextra,junit,json --reporter-htmlextra-export reports/html/create-booking-api-report.html --reporter-junit-export reports/junit/create-booking-api-junit.xml --reporter-json-export reports/json/newman-report.json` | Runs the current create booking collection against the Dev environment and generates HTML, JUnit, and JSON reports. |

---

## How to Run Tests Locally

### Run all collections with all environments

```bash
npm run test:postman
```

This command executes:

```bash
sh scripts/run-all-collections.sh
```

The script will:

1. Look for all files matching:

```text
collections/*.postman_collection.json
```

2. Look for all files matching:

```text
environments/*.postman_environment.json
```

3. Run every collection against every environment.

4. Generate reports under:

```text
reports/html/
reports/junit/
reports/json/
```

### Run the current single collection

```bash
npm run test:postman:single
```

This command runs:

```text
collections/create-booking-api.postman_collection.json
```

with:

```text
environments/Dev.postman_environment.json
```

---

## Test Reports

After running tests, reports are generated under the `reports/` directory.

```text
reports/
├── html/
├── junit/
├── json/
└── email/
```

| Report Folder    | Purpose                                                                       |
| ---------------- | ----------------------------------------------------------------------------- |
| `reports/html/`  | Stores detailed Newman HTML reports generated by `newman-reporter-htmlextra`. |
| `reports/junit/` | Stores JUnit XML reports for Jenkins test result publishing.                  |
| `reports/json/`  | Stores Newman JSON reports used by the email report generator.                |
| `reports/email/` | Stores the generated Jenkins email report HTML.                               |

### Open HTML report locally

After running the test, open the generated HTML file from:

```text
reports/html/
```

Example:

```text
reports/html/create-booking-api-Dev-report.html
```

or for the single test script:

```text
reports/html/create-booking-api-report.html
```

---

## Docker Usage

The root `Dockerfile` builds a Newman runner image.

### Build Docker image

```bash
docker build -t postman-newman-runner .
```

### Run tests inside Docker

```bash
docker run --rm \
  -v "$(pwd)/reports:/app/reports" \
  postman-newman-runner
```

Explanation:

| Part                               | Meaning                                                                            |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| `docker run --rm`                  | Runs the container and removes it after execution.                                 |
| `-v "$(pwd)/reports:/app/reports"` | Mounts local `reports/` folder so generated reports are available on your machine. |
| `postman-newman-runner`            | Docker image name.                                                                 |

The Docker container runs this command by default:

```bash
npm run test:postman
```

---

## Jenkins Setup with Docker Compose

This repository includes a Docker Compose file for running Jenkins locally:

```text
docker-compose.jenkins.yml
```

### Start Jenkins

```bash
docker compose -f docker-compose.jenkins.yml up -d --build
```

Jenkins will be available at:

```text
http://localhost:8090
```

### Stop Jenkins

```bash
docker compose -f docker-compose.jenkins.yml down
```

### Jenkins container details

| Setting             | Value                                       |
| ------------------- | ------------------------------------------- |
| Container name      | `jenkins-postman`                           |
| Jenkins port        | `8090:8080`                                 |
| Agent port          | `50000:50000`                               |
| Timezone            | `Asia/Ho_Chi_Minh`                          |
| Jenkins home volume | `jenkins_home:/var/jenkins_home`            |
| Docker socket       | `/var/run/docker.sock:/var/run/docker.sock` |

### Why Docker socket is mounted

The Jenkins pipeline builds and runs Docker containers. To allow Jenkins inside a container to control Docker on the host machine, this file mounts:

```text
/var/run/docker.sock:/var/run/docker.sock
```

---

## Jenkins Pipeline

The pipeline is defined in:

```text
Jenkinsfile
```

### Pipeline Schedule

The Jenkinsfile contains this cron trigger:

```groovy
cron('0 7,19 * * *')
```

This means Jenkins is configured to run the job every day at:

```text
07:00
19:00
```

The Docker Compose Jenkins service is configured with:

```text
TZ=Asia/Ho_Chi_Minh
JAVA_OPTS=-Duser.timezone=Asia/Ho_Chi_Minh
```

Therefore, when Jenkins is running with this Compose setup, the schedule is intended to follow Vietnam timezone.

### Pipeline Stages

| Stage                                   | Purpose                                                                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `Checkout`                              | Pulls the latest source code from Git.                                                                                        |
| `Prepare Reports Folder`                | Cleans and recreates report folders. Also removes the temporary Newman container if it already exists.                        |
| `Build Docker Image`                    | Builds the Newman runner Docker image from the root `Dockerfile`.                                                             |
| `Run Postman Tests and Collect Reports` | Creates and runs a Docker container, executes Newman tests, generates email report, copies reports back to Jenkins workspace. |

### Jenkins Post Actions

The pipeline always performs the following actions:

| Action                   | Purpose                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| Publish JUnit report     | Reads XML reports from `reports/junit/*.xml`.                     |
| Archive artifacts        | Archives all files under `reports/**/*`.                          |
| Send email report        | Sends `reports/email/email-report.html` using Jenkins `emailext`. |
| Cleanup Docker resources | Removes temporary container and prunes unused Docker images.      |

---

## Jenkins Email Report

The email report is generated by:

```text
scripts/generate-email-report.js
```

Generated output:

```text
reports/email/email-report.html
```

The script reads Newman JSON reports from:

```text
reports/json/
```

Then it creates a summary containing:

* Jenkins job name
* Build number
* Build status
* Branch
* Commit ID
* Collection count
* Environment count
* Request totals
* Assertion totals
* Pass/fail rate
* Failed test analysis
* Environment coverage
* Report/evidence locations

### Jenkins email recipient

The current Jenkinsfile uses:

```groovy
EMAIL_TO = 'trungtinle301099@gmail.com'
```

If another user clones this repository, they should update this value in `Jenkinsfile`.

Example:

```groovy
EMAIL_TO = 'your-email@example.com'
```

---

## How to Add a New Postman Collection

To add a new API test collection:

1. Export the collection from Postman.

2. Save it inside:

```text
collections/
```

3. Make sure the file name follows this format:

```text
<collection-name>.postman_collection.json
```

Example:

```text
collections/get-booking-api.postman_collection.json
collections/auth-api.postman_collection.json
collections/update-booking-api.postman_collection.json
```

4. Run all tests:

```bash
npm run test:postman
```

The script will automatically detect the new collection.

### Important naming rule

The file must end with:

```text
.postman_collection.json
```

If the file does not follow this pattern, `scripts/run-all-collections.sh` will not pick it up.

---

## How to Add a New Postman Environment

To add a new environment:

1. Export the environment from Postman.

2. Save it inside:

```text
environments/
```

3. Make sure the file name follows this format:

```text
<EnvironmentName>.postman_environment.json
```

Example:

```text
environments/Staging.postman_environment.json
environments/Production.postman_environment.json
```

4. Run all tests:

```bash
npm run test:postman
```

The runner script will automatically execute every collection against every environment.

### Important naming rule

The file must end with:

```text
.postman_environment.json
```

If the file does not follow this pattern, it will not be executed by the current runner script.

---

## How the Multi-Collection Runner Works

The main runner script is:

```text
scripts/run-all-collections.sh
```

It uses this logic:

```text
For each collection in collections/*.postman_collection.json
  For each environment in environments/*.postman_environment.json
    Run Newman
    Generate HTML report
    Generate JUnit XML report
    Generate JSON report
```

Report naming format:

```text
<collection-name>-<environment-name>-report.html
<collection-name>-<environment-name>-junit.xml
<collection-name>-<environment-name>-newman-report.json
```

Example:

```text
create-booking-api-Dev-report.html
create-booking-api-Dev-junit.xml
create-booking-api-Dev-newman-report.json
```

---

## How to Write Postman Test Scripts

This project stores API test logic inside Postman collection files.

The current collection uses:

* Pre-request scripts to prepare test data.
* Postman test scripts to validate response status and response body.
* Collection variables for reusable request data.
* Environment variables for base URL.

### Recommended Postman scripting convention

When adding a new request, follow this structure.

### 1. Use environment variables for environment-specific data

Example:

```javascript
const baseUrl = pm.environment.get("URL");
```

Do not hard-code base URLs directly in request URLs.

Recommended request URL format:

```text
{{URL}}/booking
```

### 2. Use pre-request script for dynamic or reusable test data

Example:

```javascript
pm.collectionVariables.set("dataFirstName", "Jim");
pm.collectionVariables.set("dataLastName", "Brown");
pm.collectionVariables.set("dataTotalPrice", 111);
pm.collectionVariables.set("dataDepositPaid", true);
```

### 3. Use clear assertion names

Good:

```javascript
pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});
```

Good:

```javascript
pm.test("firstname is correct", function () {
  const response = pm.response.json();
  const expectedFirstName = pm.collectionVariables.get("dataFirstName");

  pm.expect(response.booking.firstname).to.eql(expectedFirstName);
});
```

Avoid vague test names:

```javascript
pm.test("test 1", function () {
  // Not recommended
});
```

### 4. Validate both status code and response body

Recommended:

```javascript
pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Response contains bookingid", function () {
  const response = pm.response.json();

  pm.expect(response).to.have.property("bookingid");
  pm.expect(response.bookingid).to.be.a("number");
});
```

### 5. Keep data names readable

Recommended variable naming:

```text
dataFirstName
dataLastName
dataTotalPrice
dataDepositPaid
dataCheckIn
dataCheckOut
dataAdditionalNeeds
```

Avoid unclear names:

```text
fn
ln
tp
d1
d2
```

### 6. Avoid committing sensitive data

Do not commit real credentials, private tokens, or production secrets into:

```text
collections/
environments/
```

The current `.gitignore` excludes `.env`, but Postman environment JSON files are still committed. Review environment files before pushing.

---

## How to Add a New npm Script

Current scripts are defined in:

```text
package.json
```

Example existing script:

```json
{
  "scripts": {
    "test:postman": "sh scripts/run-all-collections.sh"
  }
}
```

If you want to add a script for a specific collection, follow this style:

```json
{
  "scripts": {
    "test:postman:booking": "newman run collections/create-booking-api.postman_collection.json -e environments/Dev.postman_environment.json -r cli,htmlextra,junit,json --reporter-htmlextra-export reports/html/create-booking-api-report.html --reporter-junit-export reports/junit/create-booking-api-junit.xml --reporter-json-export reports/json/create-booking-api-newman-report.json"
  }
}
```

Then run:

```bash
npm run test:postman:booking
```

Important:

* Keep script names clear.
* Use `test:postman:<scope>` naming for new test scripts.
* Always export reports into the `reports/` folder.
* Keep report file names unique to avoid overwriting previous reports.

---

## Coding and Project Conventions

### File naming conventions

| Type                | Required Pattern             | Example                                      |
| ------------------- | ---------------------------- | -------------------------------------------- |
| Postman Collection  | `*.postman_collection.json`  | `create-booking-api.postman_collection.json` |
| Postman Environment | `*.postman_environment.json` | `Dev.postman_environment.json`               |
| HTML Report         | `*-report.html`              | `create-booking-api-Dev-report.html`         |
| JUnit Report        | `*-junit.xml`                | `create-booking-api-Dev-junit.xml`           |
| JSON Report         | `*-newman-report.json`       | `create-booking-api-Dev-newman-report.json`  |

### Folder conventions

| Folder          | Rule                                                                 |
| --------------- | -------------------------------------------------------------------- |
| `collections/`  | Only Postman collection JSON files should be placed here.            |
| `environments/` | Only Postman environment JSON files should be placed here.           |
| `scripts/`      | Store automation scripts such as shell runners or report generators. |
| `reports/`      | Generated output only. This folder is ignored by Git.                |
| `jenkins/`      | Jenkins-related Docker setup files.                                  |

### Report convention

All generated reports should stay under:

```text
reports/
```

Do not commit generated reports unless there is a specific reason.

---

## Troubleshooting

### 1. `newman: command not found`

Cause:

* Dependencies are not installed.

Fix:

```bash
npm install
```

or:

```bash
npm ci
```

Then run again:

```bash
npm run test:postman
```

---

### 2. No Postman collection files found

Error from runner script:

```text
ERROR: No Postman collection files found in collections/
```

Cause:

* `collections/` is empty.
* Collection file name does not end with `.postman_collection.json`.

Fix:

```text
collections/<collection-name>.postman_collection.json
```

---

### 3. No Postman environment files found

Error from runner script:

```text
ERROR: No Postman environment files found in environments/
```

Cause:

* `environments/` is empty.
* Environment file name does not end with `.postman_environment.json`.

Fix:

```text
environments/<EnvironmentName>.postman_environment.json
```

---

### 4. HTML report is not generated

Possible causes:

* Newman execution failed before report generation.
* `newman-reporter-htmlextra` is not installed.
* `reports/html/` folder cannot be created.

Fix:

```bash
npm install
npm run test:postman
```

Check:

```bash
ls -la reports/html
```

---

### 5. Jenkins cannot run Docker commands

Possible causes:

* Docker socket is not mounted.
* Jenkins container does not have permission to access Docker.
* Docker CLI is not installed inside Jenkins container.

This project addresses Docker CLI installation through:

```text
jenkins/Dockerfile
```

And mounts Docker socket through:

```text
docker-compose.jenkins.yml
```

Check Jenkins container:

```bash
docker exec -it jenkins-postman docker version
```

---

### 6. Jenkins email is not sent

Possible causes:

* Jenkins Email Extension Plugin is missing.
* SMTP configuration is not configured in Jenkins.
* `EMAIL_TO` is incorrect.
* `reports/email/email-report.html` was not generated.

Check generated email report:

```bash
ls -la reports/email
```

Check Jenkins email configuration:

```text
Manage Jenkins > System > Extended E-mail Notification
```

---

### 7. Jenkins schedule does not match Vietnam time

The Docker Compose file sets:

```text
TZ=Asia/Ho_Chi_Minh
JAVA_OPTS=-Duser.timezone=Asia/Ho_Chi_Minh
```

Check Jenkins container time:

```bash
docker exec -it jenkins-postman date
```

Check Java timezone:

```bash
docker exec -it jenkins-postman java -XshowSettings:properties -version 2>&1 | grep user.timezone
```

Expected timezone:

```text
Asia/Ho_Chi_Minh
```

---

## Best Practices

### Postman Collection Best Practices

* Keep each API flow in a clear request or folder.
* Use meaningful request names.
* Use environment variables for URLs and environment-specific values.
* Use collection variables for reusable test data.
* Validate status code, response structure, and business data.
* Do not commit real secrets or production credentials.
* Keep assertion names readable and specific.

### Newman Best Practices

* Always generate JSON report if you need summary processing.
* Always generate JUnit report if Jenkins needs test result publishing.
* Always generate HTML report for manual review.
* Keep report names unique by collection and environment.

### Jenkins Best Practices

* Keep generated reports as archived artifacts.
* Publish JUnit reports for Jenkins test trend visibility.
* Send email report after every run.
* Clean temporary Docker containers before and after execution.
* Keep Docker image names and container names consistent.
* Do not hard-code private email/password values directly in source.

### Docker Best Practices

* Use `npm ci` in Docker for reproducible dependency installation.
* Keep `node_modules` out of Docker build context.
* Keep generated `reports/` out of Docker build context.
* Mount `reports/` when running Docker locally if you want reports on your host machine.

---

## Current Limitations

The current source does not include:

* `.env.example`
* ESLint configuration
* Prettier configuration
* TypeScript configuration
* Playwright test framework
* Allure report configuration
* GitHub Actions workflow
* License file
* Multiple environments beyond `Dev`
* Multiple collections beyond `create-booking-api`

---

## License

License information is not provided in the current source.

```
```
