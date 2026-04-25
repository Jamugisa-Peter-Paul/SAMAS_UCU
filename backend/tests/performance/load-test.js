/**
 * SAMAS Performance Load Tests
 * Tool: k6 (https://k6.io)
 * Run: k6 run tests/performance/load-test.js
 *
 * Tests three scenarios:
 *   smoke  - 1 VU, 30s  (baseline sanity check)
 *   load   - ramp to 50 VUs over 10m (normal traffic)
 *   stress - ramp to 200 VUs (find breaking point)
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─── Custom Metrics ────────────────────────────────────────────────────────────
const errorRate    = new Rate('error_rate');
const loginLatency = new Trend('login_latency', true);
const apiLatency   = new Trend('api_latency', true);
const totalErrors  = new Counter('total_errors');

// ─── Test Configuration ────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { scenario: 'smoke' },
    },
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },  // ramp up
        { duration: '5m', target: 50 },  // steady state
        { duration: '2m', target: 0 },   // ramp down
      ],
      tags: { scenario: 'load' },
    },
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '3m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '3m', target: 200 }, // hold peak
        { duration: '2m', target: 0 },   // ramp down
      ],
      tags: { scenario: 'stress' },
    },
  },
  thresholds: {
    // 95th-percentile response time must stay under 500ms
    http_req_duration: ['p(95)<500'],
    // Error rate must stay below 1%
    error_rate: ['rate<0.01'],
    // 99th-percentile login must stay under 800ms
    login_latency: ['p(99)<800'],
  },
};

// ─── Shared Test Data ──────────────────────────────────────────────────────────
const TEST_USERS = {
  admin:    { email: 'admin@ucu.ac.ug',    password: 'Admin@1234' },
  lecturer: { email: 'dr.smith@ucu.ac.ug', password: 'Lecturer@1234' },
  student:  { email: 'student1@ucu.ac.ug', password: 'Student@1234' },
};

const HEADERS = { 'Content-Type': 'application/json' };

// ─── Helper: login and return bearer token ────────────────────────────────────
function login(credentials) {
  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify(credentials),
    { headers: HEADERS }
  );
  loginLatency.add(Date.now() - start);

  const ok = check(res, {
    'login status 200': (r) => r.status === 200,
    'login returns token': (r) => {
      try { return JSON.parse(r.body).data.token !== undefined; }
      catch { return false; }
    },
  });

  if (!ok) {
    errorRate.add(1);
    totalErrors.add(1);
    return null;
  }
  errorRate.add(0);
  return JSON.parse(res.body).data.token;
}

// ─── Main Virtual User Function ───────────────────────────────────────────────
export default function () {
  // Pick a random user type so load is spread across roles
  const roles = Object.values(TEST_USERS);
  const creds  = roles[Math.floor(Math.random() * roles.length)];

  const token = login(creds);
  if (!token) { sleep(1); return; }

  const authHeaders = { ...HEADERS, Authorization: `Bearer ${token}` };

  // ── Scenario A: Health Check ───────────────────────────────────────────────
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/api/health`);
    const ok  = check(res, {
      'health 200':     (r) => r.status === 200,
      'health fast':    (r) => r.timings.duration < 100,
      'health message': (r) => {
        try { return JSON.parse(r.body).message === 'SAMAS API is running'; }
        catch { return false; }
      },
    });
    apiLatency.add(res.timings.duration);
    errorRate.add(!ok ? 1 : 0);
  });

  sleep(0.5);

  // ── Scenario B: Course Listing (most frequent read) ───────────────────────
  group('Browse Courses', () => {
    const res = http.get(`${BASE_URL}/api/courses`, { headers: authHeaders });
    const ok  = check(res, {
      'courses 200':    (r) => r.status === 200,
      'courses < 300ms': (r) => r.timings.duration < 300,
    });
    apiLatency.add(res.timings.duration);
    if (!ok) { errorRate.add(1); totalErrors.add(1); }
    else { errorRate.add(0); }
  });

  sleep(0.5);

  // ── Scenario C: Dashboard Analytics ──────────────────────────────────────
  group('Dashboard Analytics', () => {
    const res = http.get(`${BASE_URL}/api/analytics/dashboard`, { headers: authHeaders });
    const ok  = check(res, {
      'dashboard 200':    (r) => r.status === 200,
      'dashboard < 400ms': (r) => r.timings.duration < 400,
    });
    apiLatency.add(res.timings.duration);
    if (!ok) { errorRate.add(1); totalErrors.add(1); }
    else { errorRate.add(0); }
  });

  sleep(0.5);

  // ── Scenario D: Notifications ────────────────────────────────────────────
  group('Notifications', () => {
    const res = http.get(`${BASE_URL}/api/notifications`, { headers: authHeaders });
    check(res, { 'notifications 200': (r) => r.status === 200 });
    apiLatency.add(res.timings.duration);
  });

  sleep(1);
}

// ─── Setup: seed required test users if not present ──────────────────────────
export function setup() {
  for (const [role, creds] of Object.entries(TEST_USERS)) {
    http.post(
      `${BASE_URL}/api/auth/register`,
      JSON.stringify({ ...creds, fullName: `Test ${role}`, role }),
      { headers: HEADERS }
    );
  }
}
