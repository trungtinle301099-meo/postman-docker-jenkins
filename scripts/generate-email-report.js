const fs = require('fs');
const path = require('path');

const REPORT_JSON_PATH = path.join(process.cwd(), 'reports/json/newman-report.json');
const EMAIL_REPORT_PATH = path.join(process.cwd(), 'reports/email/email-report.html');
const ENV_PATH = path.join(process.cwd(), 'environments/Dev.postman_environment.json');

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

function getEnvValue(key) {
  try {
    if (!fs.existsSync(ENV_PATH)) return 'N/A';
    const env = JSON.parse(fs.readFileSync(ENV_PATH, 'utf8'));
    const item = (env.values || []).find(v => v.key === key);
    return item?.value || item?.currentValue || 'N/A';
  } catch {
    return 'N/A';
  }
}

function statusBadge(status) {
  const normalized = String(status || 'UNKNOWN').toUpperCase();

  if (normalized === 'PASS' || normalized === 'PASSED' || normalized === 'SUCCESS') {
    return '<span style="color:#16a34a;font-weight:bold;">PASSED</span>';
  }

  if (normalized === 'FAIL' || normalized === 'FAILED' || normalized === 'FAILURE') {
    return '<span style="color:#dc2626;font-weight:bold;">FAILED</span>';
  }

  return `<span style="color:#d97706;font-weight:bold;">${escapeHtml(normalized)}</span>`;
}

function severityByAssertion(assertionName) {
  const name = String(assertionName || '').toLowerCase();

  if (name.includes('status code')) return 'Critical';
  if (name.includes('firstname')) return 'High';
  if (name.includes('lastname')) return 'High';
  if (name.includes('totalprice')) return 'High';
  if (name.includes('depositpaid')) return 'Medium';
  if (name.includes('checkin')) return 'Medium';
  if (name.includes('checkout')) return 'Medium';
  if (name.includes('additionalneeds')) return 'Low';

  return 'Medium';
}

function expectedResultByAssertion(assertionName) {
  const name = String(assertionName || '').toLowerCase();

  if (name.includes('status code')) return 'API returns HTTP 200';
  if (name.includes('firstname')) return 'Response firstname matches request data';
  if (name.includes('lastname')) return 'Response lastname matches request data';
  if (name.includes('totalprice')) return 'Response totalprice matches request data';
  if (name.includes('depositpaid')) return 'Response depositpaid matches request data';
  if (name.includes('checkin')) return 'Response checkin date matches request data';
  if (name.includes('checkout')) return 'Response checkout date matches request data';
  if (name.includes('additionalneeds')) return 'Response additionalneeds matches request data';

  return 'Expected result should match test assertion';
}

function createFallbackReport(message) {
  return `
  <h2>Postman API Automation Test Report</h2>
  <p><b>Status:</b> ${statusBadge(process.env.BUILD_STATUS || 'FAILURE')}</p>
  <p><b>Message:</b> ${escapeHtml(message)}</p>
  <p>Please check Jenkins console log for details.</p>
  `;
}

function main() {
  fs.mkdirSync(path.dirname(EMAIL_REPORT_PATH), { recursive: true });

  if (!fs.existsSync(REPORT_JSON_PATH)) {
    fs.writeFileSync(
      EMAIL_REPORT_PATH,
      createFallbackReport('Newman JSON report was not found. Email report could not be generated from test result data.'),
      'utf8'
    );
    return;
  }

  const report = JSON.parse(fs.readFileSync(REPORT_JSON_PATH, 'utf8'));
  const run = report.run || {};
  const stats = run.stats || {};
  const executions = run.executions || [];
  const failures = run.failures || [];

  const requestTotal = stats.requests?.total || 0;
  const requestFailed = stats.requests?.failed || 0;
  const requestPassed = Math.max(requestTotal - requestFailed, 0);

  const assertionTotal = stats.assertions?.total || 0;
  const assertionFailed = stats.assertions?.failed || 0;
  const assertionPassed = Math.max(assertionTotal - assertionFailed, 0);

  const scriptTotal = stats.testScripts?.total || 0;
  const scriptFailed = stats.testScripts?.failed || 0;
  const scriptPassed = Math.max(scriptTotal - scriptFailed, 0);

  const buildStatus = process.env.BUILD_STATUS || (assertionFailed > 0 || requestFailed > 0 ? 'FAILURE' : 'SUCCESS');
  const statusColor = buildStatus === 'SUCCESS' ? '#16a34a' : '#dc2626';

  const firstExecution = executions[0] || {};
  const request = firstExecution.request || {};
  const response = firstExecution.response || {};
  const method = request.method || 'POST';
  const endpoint = '/booking';
  const baseUrl = getEnvValue('URL');

  let assertionRows = '';
  let index = 1;

  executions.forEach(execution => {
    const responseCode = execution.response?.code ? `HTTP ${execution.response.code}` : 'No response';
    const assertions = execution.assertions || [];

    assertions.forEach(assertion => {
      const assertionName = assertion.assertion || 'Unnamed assertion';
      const isFailed = Boolean(assertion.error);
      const status = isFailed ? 'FAILED' : 'PASSED';
      const actualResult = isFailed
        ? assertion.error?.message || 'Assertion failed'
        : assertionName.toLowerCase().includes('status code')
          ? responseCode
          : 'Matched expected result';

      assertionRows += `
        <tr>
          <td>${index}</td>
          <td>${escapeHtml(assertionName)}</td>
          <td>${escapeHtml(expectedResultByAssertion(assertionName))}</td>
          <td>${escapeHtml(actualResult)}</td>
          <td>${statusBadge(status)}</td>
          <td>${escapeHtml(severityByAssertion(assertionName))}</td>
          <td>${isFailed ? 'Need investigation' : 'Passed as expected'}</td>
        </tr>
      `;
      index += 1;
    });
  });

  if (!assertionRows) {
    assertionRows = `
      <tr>
        <td colspan="7">No assertion details found in Newman JSON report.</td>
      </tr>
    `;
  }

  let failedRows = '';

  if (failures.length === 0) {
    failedRows = `
      <tr>
        <td colspan="7" style="color:#16a34a;font-weight:bold;">
          No failed test detected. All API requests and assertions passed successfully.
        </td>
      </tr>
    `;
  } else {
    failures.forEach((failure, i) => {
      const failedItem = failure.source?.name || failure.parent?.name || 'Unknown item';
      const errorName = failure.error?.name || 'Unknown Error';
      const errorMessage = failure.error?.message || 'No error message';
      const failureType = errorName.includes('Assertion') ? 'Assertion' : 'Request / Script';

      failedRows += `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(failedItem)}</td>
          <td>${escapeHtml(failureType)}</td>
          <td>${escapeHtml(errorMessage)}</td>
          <td>${escapeHtml(errorName)}</td>
          <td>May impact API validation reliability or business flow verification.</td>
          <td>Review failed request, response body, environment variables and assertion logic.</td>
        </tr>
      `;
    });
  }

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

    .summary-title {
      margin-top: 0;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <h2>POSTMAN API AUTOMATION TEST REPORT</h2>
  <p class="summary-title">Automated API test execution report generated by Jenkins, Docker and Newman.</p>

  <h3>1. Executive Summary</h3>
  <table>
    <tr>
      <th>Project / Job Name</th>
      <td>${escapeHtml(process.env.JOB_NAME)}</td>
    </tr>
    <tr>
      <th>Collection</th>
      <td>Create booking API</td>
    </tr>
    <tr>
      <th>Environment</th>
      <td>Dev</td>
    </tr>
    <tr>
      <th>Execution Tool</th>
      <td>Jenkins + Docker + Newman</td>
    </tr>
    <tr>
      <th>Execution Type</th>
      <td>Scheduled / Manual</td>
    </tr>
    <tr>
      <th>Schedule</th>
      <td>07:00 and 19:00 Asia/Ho_Chi_Minh</td>
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
      <th>Executed At</th>
      <td>${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' })} Asia/Ho_Chi_Minh</td>
    </tr>
    <tr>
      <th>Executed By</th>
      <td>Jenkins Automation</td>
    </tr>
  </table>

  <h3>2. Test Execution Summary</h3>
  <table>
    <tr>
      <th>Metric</th>
      <th>Total</th>
      <th>Passed</th>
      <th>Failed</th>
      <th>Pass Rate</th>
    </tr>
    <tr>
      <td>Requests</td>
      <td>${requestTotal}</td>
      <td style="color:#16a34a;font-weight:bold;">${requestPassed}</td>
      <td style="color:#dc2626;font-weight:bold;">${requestFailed}</td>
      <td>${percent(requestPassed, requestTotal)}%</td>
    </tr>
    <tr>
      <td>Assertions</td>
      <td>${assertionTotal}</td>
      <td style="color:#16a34a;font-weight:bold;">${assertionPassed}</td>
      <td style="color:#dc2626;font-weight:bold;">${assertionFailed}</td>
      <td>${percent(assertionPassed, assertionTotal)}%</td>
    </tr>
    <tr>
      <td>Test Scripts</td>
      <td>${scriptTotal}</td>
      <td style="color:#16a34a;font-weight:bold;">${scriptPassed}</td>
      <td style="color:#dc2626;font-weight:bold;">${scriptFailed}</td>
      <td>${percent(scriptPassed, scriptTotal)}%</td>
    </tr>
  </table>

  <h3>3. API Scope</h3>
  <table>
    <tr>
      <th>No.</th>
      <th>API Name</th>
      <th>Method</th>
      <th>Endpoint</th>
      <th>Test Purpose</th>
      <th>Priority</th>
    </tr>
    <tr>
      <td>1</td>
      <td>Create Booking</td>
      <td><b>${escapeHtml(method)}</b></td>
      <td>${escapeHtml(endpoint)}</td>
      <td>Verify booking can be created successfully with valid request body.</td>
      <td>High</td>
    </tr>
  </table>

  <h3>4. Test Case Result Details</h3>
  <table>
    <tr>
      <th>No.</th>
      <th>Test Case / Assertion</th>
      <th>Expected Result</th>
      <th>Actual Result</th>
      <th>Status</th>
      <th>Severity if Failed</th>
      <th>Notes</th>
    </tr>
    ${assertionRows}
  </table>

  <h3>5. Failed Test Analysis</h3>
  <table>
    <tr>
      <th>No.</th>
      <th>Failed Item</th>
      <th>Failure Type</th>
      <th>Error Message</th>
      <th>Possible Root Cause</th>
      <th>Impact</th>
      <th>Recommended Action</th>
    </tr>
    ${failedRows}
  </table>

  <h3>6. Environment & Test Data</h3>
  <table>
    <tr>
      <th>Environment</th>
      <td>Dev</td>
    </tr>
    <tr>
      <th>Base URL</th>
      <td>${escapeHtml(baseUrl)}</td>
    </tr>
    <tr>
      <th>Collection File</th>
      <td>collections/create-booking-api.postman_collection.json</td>
    </tr>
    <tr>
      <th>Environment File</th>
      <td>environments/Dev.postman_environment.json</td>
    </tr>
    <tr>
      <th>Data File</th>
      <td>N/A</td>
    </tr>
    <tr>
      <th>Docker Image</th>
      <td>postman-newman-runner</td>
    </tr>
    <tr>
      <th>Newman Reporter</th>
      <td>cli, htmlextra, junit, json</td>
    </tr>
  </table>

  <h3>7. Jenkins Build Information</h3>
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
    <tr>
      <th>Duration</th>
      <td>Please check Jenkins build page</td>
    </tr>
  </table>

  <h3>8. Reports & Evidence</h3>
  <table>
    <tr>
      <th>Evidence Type</th>
      <th>Status</th>
      <th>Location</th>
    </tr>
    <tr>
      <td>Newman HTML Report</td>
      <td>Generated</td>
      <td>Attached in email / Jenkins artifacts</td>
    </tr>
    <tr>
      <td>JUnit Report</td>
      <td>Published</td>
      <td>Jenkins Test Result</td>
    </tr>
    <tr>
      <td>Console Log</td>
      <td>Available</td>
      <td>Jenkins Build Console Output</td>
    </tr>
    <tr>
      <td>Build Artifact</td>
      <td>Archived</td>
      <td>Jenkins Build Artifacts</td>
    </tr>
  </table>

  <hr/>
  <p class="muted">
    This is an automated report generated by Jenkins, Docker and Newman.
    Please review the attached Newman HTML report for full request, response, assertion and execution details.
  </p>
</body>
</html>
`;

  fs.writeFileSync(EMAIL_REPORT_PATH, html, 'utf8');
}

main();
