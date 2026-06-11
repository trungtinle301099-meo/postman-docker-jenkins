const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const JSON_REPORT_DIR = path.join(ROOT, 'reports/json');
const EMAIL_REPORT_PATH = path.join(ROOT, 'reports/email/email-report.html');
const ENV_DIR = path.join(ROOT, 'environments');

function escapeHtml(value) {
  if (value === undefined || value === null || value === '') return 'N/A';

  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function percent(passed, total) {
  if (!total || total === 0) return '0.00';
  return ((passed / total) * 100).toFixed(2);
}

function statusBadge(status) {
  const normalized = String(status || 'UNKNOWN').toUpperCase();

  if (normalized === 'PASSED' || normalized === 'SUCCESS') {
    return '<span style="color:#16a34a;font-weight:bold;">PASSED</span>';
  }

  if (normalized === 'FAILED' || normalized === 'FAILURE') {
    return '<span style="color:#dc2626;font-weight:bold;">FAILED</span>';
  }

  return `<span style="color:#d97706;font-weight:bold;">${escapeHtml(normalized)}</span>`;
}

function getJsonFiles() {
  if (!fs.existsSync(JSON_REPORT_DIR)) return [];

  return fs
    .readdirSync(JSON_REPORT_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(JSON_REPORT_DIR, file));
}

function readEnvironmentInfo() {
  if (!fs.existsSync(ENV_DIR)) return [];

  return fs
    .readdirSync(ENV_DIR)
    .filter(file => file.endsWith('.postman_environment.json'))
    .map((file, index) => {
      const filePath = path.join(ENV_DIR, file);
      const envName = file.replace('.postman_environment.json', '');

      let baseUrl = 'N/A';

      try {
        const env = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const values = env.values || [];

        const urlItem =
          values.find(item => item.key === 'URL') ||
          values.find(item => item.key === 'BASE_URL') ||
          values.find(item => item.key === 'baseUrl') ||
          values.find(item => item.key === 'url');

        baseUrl = urlItem?.value || urlItem?.currentValue || 'N/A';
      } catch {
        baseUrl = 'N/A';
      }

      return {
        no: index + 1,
        envName,
        baseUrl,
      };
    });
}

function parseReportName(fileName, collectionNameFromReport) {
  const cleanName = fileName.replace('-newman-report.json', '');

  const envFiles = fs.existsSync(ENV_DIR)
    ? fs
        .readdirSync(ENV_DIR)
        .filter(file => file.endsWith('.postman_environment.json'))
        .map(file => file.replace('.postman_environment.json', ''))
    : [];

  const matchedEnv = envFiles.find(env => cleanName.endsWith(`-${env}`));

  if (matchedEnv) {
    return {
      collectionName: cleanName.replace(`-${matchedEnv}`, ''),
      environmentName: matchedEnv,
    };
  }

  return {
    collectionName: collectionNameFromReport || cleanName,
    environmentName: 'N/A',
  };
}

function main() {
  fs.mkdirSync(path.dirname(EMAIL_REPORT_PATH), { recursive: true });

  const jsonFiles = getJsonFiles();

  if (jsonFiles.length === 0) {
    fs.writeFileSync(
      EMAIL_REPORT_PATH,
      `
      <h2>POSTMAN API AUTOMATION TEST REPORT</h2>
      <p><b>Status:</b> ${statusBadge(process.env.BUILD_STATUS || 'FAILURE')}</p>
      <p><b>Error:</b> No Newman JSON report files found in reports/json.</p>
      <p>Please check Jenkins console log and Newman execution result.</p>
      `,
      'utf8'
    );
    return;
  }

  const results = [];
  const failedItems = [];

  let totalRequests = 0;
  let failedRequests = 0;

  let totalAssertionsForReport = 0;
  let passedAssertionsForReport = 0;
  let failedAssertionsForReport = 0;

  for (const jsonFile of jsonFiles) {
    const fileName = path.basename(jsonFile);
    const report = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));

    const run = report.run || {};
    const stats = run.stats || {};
    const collectionNameFromReport = report.collection?.info?.name;

    const parsedName = parseReportName(fileName, collectionNameFromReport);

    const requestTotal = stats.requests?.total || 0;
    const requestFailed = stats.requests?.failed || 0;
    const requestPassed = Math.max(requestTotal - requestFailed, 0);

    const rawAssertionTotal = stats.assertions?.total || 0;
    const rawAssertionFailed = stats.assertions?.failed || 0;
    const rawAssertionPassed = Math.max(rawAssertionTotal - rawAssertionFailed, 0);

    /**
     * Important:
     * Newman separates request errors from assertion failures.
     *
     * Example from console:
     * requests.failed = 2
     * assertions.failed = 0
     *
     * From QA report perspective, failed request executions must be visible in:
     * - Overall Test Execution Summary -> Assertions row
     * - Collection x Environment Result Matrix -> Failed column
     *
     * Therefore we calculate report-level failed checks as:
     * assertion failures + request failures.
     */
    const reportAssertionFailed = rawAssertionFailed + requestFailed;
    const reportAssertionPassed = rawAssertionPassed;
    const reportAssertionTotal = rawAssertionTotal + requestFailed;

    const failures = run.failures || [];
    const runFailed = requestFailed > 0 || rawAssertionFailed > 0 || failures.length > 0;

    totalRequests += requestTotal;
    failedRequests += requestFailed;

    totalAssertionsForReport += reportAssertionTotal;
    passedAssertionsForReport += reportAssertionPassed;
    failedAssertionsForReport += reportAssertionFailed;

    results.push({
      collectionName: parsedName.collectionName,
      environmentName: parsedName.environmentName,
      requestTotal,
      requestPassed,
      requestFailed,
      assertionTotal: reportAssertionTotal,
      assertionPassed: reportAssertionPassed,
      assertionFailed: reportAssertionFailed,
      passRate: percent(reportAssertionPassed, reportAssertionTotal),
      status: runFailed ? 'FAILED' : 'PASSED',
      htmlReport: fileName.replace('-newman-report.json', '-report.html'),
    });

    failures.forEach(failure => {
      const errorName = failure.error?.name || 'Error';
      const errorMessage = failure.error?.message || 'No error message';
      const failedItem =
        failure.source?.name ||
        failure.parent?.name ||
        failure.cursor?.ref ||
        'Unknown item';

      failedItems.push({
        collectionName: parsedName.collectionName,
        environmentName: parsedName.environmentName,
        failedItem,
        failureType: errorName,
        errorMessage,
      });
    });
  }

  const passedRequests = Math.max(totalRequests - failedRequests, 0);

  const totalRuns = results.length;
  const failedRuns = results.filter(item => item.status === 'FAILED').length;
  const passedRuns = Math.max(totalRuns - failedRuns, 0);

  const uniqueCollections = new Set(results.map(item => item.collectionName)).size;
  const uniqueEnvironments = new Set(results.map(item => item.environmentName)).size;

  const buildStatus = process.env.BUILD_STATUS || (failedRuns > 0 ? 'FAILURE' : 'SUCCESS');
  const statusColor = buildStatus === 'SUCCESS' ? '#16a34a' : '#dc2626';

  const resultRows = results
    .map(
      (item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(item.collectionName)}</td>
      <td>${escapeHtml(item.environmentName)}</td>
      <td>${item.requestTotal}</td>
      <td>${item.assertionTotal}</td>
      <td style="color:${item.assertionFailed > 0 ? '#dc2626' : '#16a34a'};font-weight:bold;">${item.assertionFailed}</td>
      <td>${item.passRate}%</td>
      <td>${statusBadge(item.status)}</td>
      <td>${escapeHtml(item.htmlReport)}</td>
    </tr>
  `
    )
    .join('');

  const failedRows =
    failedItems.length === 0
      ? `
      <tr>
        <td colspan="7" style="color:#16a34a;font-weight:bold;">
          No failed test detected. All collections and environments passed successfully.
        </td>
      </tr>
    `
      : failedItems
          .map(
            (item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.collectionName)}</td>
        <td>${escapeHtml(item.environmentName)}</td>
        <td>${escapeHtml(item.failedItem)}</td>
        <td>${escapeHtml(item.failureType)}</td>
        <td>${escapeHtml(item.errorMessage)}</td>
        <td>Review request URL, method, environment variables, request dependency and assertion logic.</td>
      </tr>
    `
          )
          .join('');

  const envInfo = readEnvironmentInfo();

  const envRows =
    envInfo.length === 0
      ? `
      <tr>
        <td colspan="4">No environment files found.</td>
      </tr>
    `
      : envInfo
          .map(
            item => `
      <tr>
        <td>${item.no}</td>
        <td>${escapeHtml(item.envName)}</td>
        <td>${escapeHtml(item.baseUrl)}</td>
        <td>Executed</td>
      </tr>
    `
          )
          .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      line-height: 1.5;
    }

    h2 {
      color: #111827;
      margin-bottom: 4px;
    }

    h3 {
      color: #1f2937;
      margin-top: 24px;
      margin-bottom: 10px;
    }

    p {
      margin: 6px 0;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 16px;
      font-size: 14px;
    }

    th {
      background-color: #f3f4f6;
      color: #111827;
      text-align: left;
      font-weight: bold;
    }

    th, td {
      border: 1px solid #d1d5db;
      padding: 8px;
      vertical-align: top;
    }

    .muted {
      color: #6b7280;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <h2>POSTMAN API AUTOMATION TEST REPORT</h2>
  <p class="muted">Multi-collection and multi-environment automated API test report generated by Jenkins, Docker and Newman.</p>

  <h3>1. Executive Summary</h3>
  <table>
    <tr>
      <th>Jenkins Job</th>
      <td>${escapeHtml(process.env.JOB_NAME)}</td>
    </tr>
    <tr>
      <th>Execution Tool</th>
      <td>Jenkins + Docker + Newman</td>
    </tr>
    <tr>
      <th>Execution Scope</th>
      <td>All Postman Collections x All Environments</td>
    </tr>
    <tr>
      <th>Total Collections</th>
      <td>${uniqueCollections}</td>
    </tr>
    <tr>
      <th>Total Environments</th>
      <td>${uniqueEnvironments}</td>
    </tr>
    <tr>
      <th>Total Runs</th>
      <td>${totalRuns}</td>
    </tr>
    <tr>
      <th>Build Status</th>
      <td><span style="color:${statusColor};font-weight:bold;">${escapeHtml(buildStatus)}</span></td>
    </tr>
    <tr>
      <th>Executed At</th>
      <td>${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' })} Asia/Ho_Chi_Minh</td>
    </tr>
    <tr>
      <th>Schedule</th>
      <td>07:00 and 19:00 Asia/Ho_Chi_Minh</td>
    </tr>
  </table>

  <h3>2. Overall Test Execution Summary</h3>
  <table>
    <tr>
      <th>Metric</th>
      <th>Total</th>
      <th>Passed</th>
      <th>Failed</th>
      <th>Pass Rate</th>
    </tr>
    <tr>
      <td>Collection Runs</td>
      <td>${totalRuns}</td>
      <td style="color:#16a34a;font-weight:bold;">${passedRuns}</td>
      <td style="color:#dc2626;font-weight:bold;">${failedRuns}</td>
      <td>${percent(passedRuns, totalRuns)}%</td>
    </tr>
    <tr>
      <td>Requests</td>
      <td>${totalRequests}</td>
      <td style="color:#16a34a;font-weight:bold;">${passedRequests}</td>
      <td style="color:#dc2626;font-weight:bold;">${failedRequests}</td>
      <td>${percent(passedRequests, totalRequests)}%</td>
    </tr>
    <tr>
      <td>Assertions</td>
      <td>${totalAssertionsForReport}</td>
      <td style="color:#16a34a;font-weight:bold;">${passedAssertionsForReport}</td>
      <td style="color:#dc2626;font-weight:bold;">${failedAssertionsForReport}</td>
      <td>${percent(passedAssertionsForReport, totalAssertionsForReport)}%</td>
    </tr>
  </table>

  <h3>3. Collection x Environment Result Matrix</h3>
  <table>
    <tr>
      <th>No.</th>
      <th>Collection</th>
      <th>Environment</th>
      <th>Requests</th>
      <th>Assertions</th>
      <th>Failed</th>
      <th>Pass Rate</th>
      <th>Status</th>
      <th>HTML Report</th>
    </tr>
    ${resultRows}
  </table>

  <h3>4. Failed Test Analysis</h3>
  <table>
    <tr>
      <th>No.</th>
      <th>Collection</th>
      <th>Environment</th>
      <th>Failed Item</th>
      <th>Failure Type</th>
      <th>Error Message</th>
      <th>Recommended Action</th>
    </tr>
    ${failedRows}
  </table>

  <h3>5. Environment Coverage</h3>
  <table>
    <tr>
      <th>No.</th>
      <th>Environment</th>
      <th>Base URL</th>
      <th>Status</th>
    </tr>
    ${envRows}
  </table>

  <h3>6. Jenkins Build Information</h3>
  <table>
    <tr>
      <th>Jenkins Job</th>
      <td>${escapeHtml(process.env.JOB_NAME)}</td>
    </tr>
    <tr>
      <th>Build Number</th>
      <td>#${escapeHtml(process.env.BUILD_NUMBER)}</td>
    </tr>
    <tr>
      <th>Build Status</th>
      <td><span style="color:${statusColor};font-weight:bold;">${escapeHtml(buildStatus)}</span></td>
    </tr>
    <tr>
      <th>Branch</th>
      <td>${escapeHtml(process.env.BRANCH_NAME || 'main')}</td>
    </tr>
    <tr>
      <th>Commit ID</th>
      <td>${escapeHtml(process.env.GIT_COMMIT)}</td>
    </tr>
    <tr>
      <th>Build URL</th>
      <td><a href="${escapeHtml(process.env.BUILD_URL)}">${escapeHtml(process.env.BUILD_URL)}</a></td>
    </tr>
    <tr>
      <th>Console Log</th>
      <td><a href="${escapeHtml(process.env.BUILD_URL)}console">${escapeHtml(process.env.BUILD_URL)}console</a></td>
    </tr>
  </table>

  <h3>7. Reports & Evidence</h3>
  <table>
    <tr>
      <th>Evidence Type</th>
      <th>Status</th>
      <th>Location</th>
    </tr>
    <tr>
      <td>Newman HTML Reports</td>
      <td>Generated</td>
      <td>Attached in email / Jenkins artifacts</td>
    </tr>
    <tr>
      <td>JUnit Reports</td>
      <td>Published</td>
      <td>Jenkins Test Result</td>
    </tr>
    <tr>
      <td>JSON Reports</td>
      <td>Archived</td>
      <td>Jenkins artifacts</td>
    </tr>
    <tr>
      <td>Console Log</td>
      <td>Available</td>
      <td>Jenkins Build Console Output</td>
    </tr>
  </table>

  <hr/>
  <p class="muted">
    Note: Newman separates assertion failures and request execution errors.
    This email report counts failed request executions as failed checks so QA summary and matrix reflect the real failed result.
  </p>
</body>
</html>
`;

  fs.writeFileSync(EMAIL_REPORT_PATH, html, 'utf8');
}

main();
