/* eslint-disable */
/**
 * k6 load test for the ExamEval API.
 *
 * Usage (needs the k6 binary: https://k6.io/docs/get-started/installation/):
 *   BASE_URL=http://localhost:5000 EMAIL=admin@exameval.com PASSWORD=Admin@123 \
 *     k6 run load/k6-script.js
 *
 * Stages ramp to 30 virtual users; thresholds fail the run if p95 latency or
 * error rate exceed budget — so you get numbers, not hand-waving.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const EMAIL = __ENV.EMAIL || 'admin@exameval.com';
const PASSWORD = __ENV.PASSWORD || 'Admin@123';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 30 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'], // 95% of requests under 800ms
    http_req_failed: ['rate<0.02'], // <2% errors
  },
};

export function setup() {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(res, { 'login ok': (r) => r.status === 200 });
  const token = res.json('data.accessToken');
  return { token };
}

export default function (data) {
  const authHeaders = { headers: { Authorization: `Bearer ${data.token}` } };

  const health = http.get(`${BASE_URL}/api/health`);
  check(health, { 'health 200': (r) => r.status === 200 });

  const evals = http.get(`${BASE_URL}/api/evaluations?limit=20`, authHeaders);
  check(evals, { 'evaluations ok': (r) => r.status === 200 });

  const courses = http.get(`${BASE_URL}/api/courses?limit=20`, authHeaders);
  check(courses, { 'courses ok': (r) => r.status === 200 });

  sleep(1);
}
