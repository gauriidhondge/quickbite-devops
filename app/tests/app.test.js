process.env.NODE_ENV = 'test';
const request = require('supertest');
const app = require('../src/app');
const store = require('../src/store');

beforeEach(() => {
  store.reset();
  delete process.env.CHAOS_DELAY_MS;
  delete process.env.CHAOS_ERROR_RATE;
});

describe('Health and metrics', () => {
  test('GET /health returns UP', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
  });

  test('GET /ready returns ready', async () => {
    const res = await request(app).get('/ready');
    expect(res.body.ready).toBe(true);
  });

  test('GET /metrics exposes Prometheus metrics', async () => {
    await request(app).get('/api/menu');
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_requests_total');
    expect(res.text).toContain('http_request_duration_seconds');
    expect(res.text).toContain('quickbite_orders_placed_total');
  });
});

describe('Menu', () => {
  test('GET /api/menu returns items', async () => {
    const res = await request(app).get('/api/menu');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('price');
  });
});

describe('Orders', () => {
  test('POST /api/orders creates an order with token and total', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ studentName: 'Gauri', items: [{ itemId: 1, qty: 2 }, { itemId: 4 }] });
    expect(res.status).toBe(201);
    expect(res.body.token).toBe(100);
    expect(res.body.total).toBe(20 * 2 + 40);
    expect(res.body.status).toBe('PLACED');
  });

  test('rejects missing studentName', async () => {
    const res = await request(app).post('/api/orders').send({ items: [{ itemId: 1 }] });
    expect(res.status).toBe(400);
  });

  test('rejects empty items', async () => {
    const res = await request(app).post('/api/orders').send({ studentName: 'A', items: [] });
    expect(res.status).toBe(400);
  });

  test('rejects unknown item', async () => {
    const res = await request(app).post('/api/orders').send({ studentName: 'A', items: [{ itemId: 99 }] });
    expect(res.status).toBe(400);
  });

  test('rejects sold-out item with 409', async () => {
    const res = await request(app).post('/api/orders').send({ studentName: 'A', items: [{ itemId: 5 }] });
    expect(res.status).toBe(409);
  });

  test('rejects invalid qty', async () => {
    const res = await request(app).post('/api/orders').send({ studentName: 'A', items: [{ itemId: 1, qty: 50 }] });
    expect(res.status).toBe(400);
  });

  test('GET /api/orders/:id returns order, 404 when missing', async () => {
    const created = await request(app).post('/api/orders').send({ studentName: 'A', items: [{ itemId: 2 }] });
    const found = await request(app).get(`/api/orders/${created.body.id}`);
    expect(found.status).toBe(200);
    const missing = await request(app).get('/api/orders/999');
    expect(missing.status).toBe(404);
  });

  test('GET /api/orders lists orders', async () => {
    await request(app).post('/api/orders').send({ studentName: 'A', items: [{ itemId: 2 }] });
    const res = await request(app).get('/api/orders');
    expect(res.body.length).toBe(1);
  });

  test('PATCH status updates and validates', async () => {
    const created = await request(app).post('/api/orders').send({ studentName: 'A', items: [{ itemId: 3 }] });
    const ok = await request(app).patch(`/api/orders/${created.body.id}/status`).send({ status: 'READY' });
    expect(ok.body.status).toBe('READY');
    const collected = await request(app).patch(`/api/orders/${created.body.id}/status`).send({ status: 'COLLECTED' });
    expect(collected.body.status).toBe('COLLECTED');
    const reopened = await request(app).patch(`/api/orders/${created.body.id}/status`).send({ status: 'PREPARING' });
    expect(reopened.status).toBe(200);
    const bad = await request(app).patch(`/api/orders/${created.body.id}/status`).send({ status: 'EATEN' });
    expect(bad.status).toBe(400);
    const missing = await request(app).patch('/api/orders/999/status').send({ status: 'READY' });
    expect(missing.status).toBe(404);
  });

  test('unknown route returns 404', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('Chaos (fault injection for SRE demo)', () => {
  test('CHAOS_ERROR_RATE=1 makes order placement fail with 500', async () => {
    process.env.CHAOS_ERROR_RATE = '1';
    const res = await request(app).post('/api/orders').send({ studentName: 'A', items: [{ itemId: 1 }] });
    expect(res.status).toBe(500);
  });

  test('CHAOS_DELAY_MS adds latency', async () => {
    process.env.CHAOS_DELAY_MS = '150';
    const start = Date.now();
    await request(app).post('/api/orders').send({ studentName: 'A', items: [{ itemId: 1 }] });
    expect(Date.now() - start).toBeGreaterThanOrEqual(140);
  });
});
