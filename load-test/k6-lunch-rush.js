// k6 load test: simulates the 1 pm canteen lunch rush.
// Run:  k6 run -e BASE_URL=http://$(minikube ip):30080 load-test/k6-lunch-rush.js
// The thresholds below ARE the SLOs - k6 exits non-zero if the SLO is violated.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:8080';
const NAMES = ['Aarav', 'Diya', 'Kabir', 'Isha', 'Rohan', 'Sneha', 'Vivaan', 'Anaya'];

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // 12:50 - students start arriving
    { duration: '1m', target: 50 },    // 1:00  - lunch bell, rush begins
    { duration: '2m', target: 50 },    // 1:00-1:15 - peak
    { duration: '30s', target: 0 },    // rush ends
  ],
  thresholds: {
    http_req_failed: ['rate<0.005'],                          // availability SLO 99.5%
    'http_req_duration{name:place_order}': ['p(95)<300'],     // latency SLO
  },
};

export default function () {
  const menu = http.get(`${BASE}/api/menu`, { tags: { name: 'get_menu' } });
  check(menu, { 'menu 200': (r) => r.status === 200 });

  const payload = JSON.stringify({
    studentName: NAMES[Math.floor(Math.random() * NAMES.length)],
    items: [
      { itemId: 1 + Math.floor(Math.random() * 4), qty: 1 + Math.floor(Math.random() * 2) },
    ],
  });
  const order = http.post(`${BASE}/api/orders`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'place_order' },
  });
  check(order, { 'order 201': (r) => r.status === 201 });

  if (order.status === 201) {
    const id = order.json('id');
    http.get(`${BASE}/api/orders/${id}`, { tags: { name: 'get_order' } });
  }
  sleep(Math.random() * 2 + 0.5);
}
