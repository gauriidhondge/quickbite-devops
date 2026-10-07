const express = require('express');
const path = require('path');
const store = require('./store');
const logger = require('./logger');
const { register, metricsMiddleware, ordersPlacedTotal, activeOrders } = require('./metrics');

const app = express();
app.use(express.json());
app.use(metricsMiddleware);
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- Chaos / fault injection (for the SRE incident demo) ----------
// CHAOS_DELAY_MS   -> adds latency to POST /orders
// CHAOS_ERROR_RATE -> fraction (0..1) of POST /orders requests that return 500
function chaos(req, res, next) {
  const delay = Number(process.env.CHAOS_DELAY_MS || 0);
  const errorRate = Number(process.env.CHAOS_ERROR_RATE || 0);
  setTimeout(() => {
    if (errorRate > 0 && Math.random() < errorRate) {
      logger.error('Injected failure on order placement', { route: req.path });
      return res.status(500).json({ error: 'Kitchen system unavailable (injected fault)' });
    }
    next();
  }, delay);
}

// ---------- Health checks (used by Kubernetes probes) ----------
app.get('/health', (req, res) => {
  res.json({ status: 'UP', version: process.env.APP_VERSION || 'dev', uptime: process.uptime() });
});

app.get('/ready', (req, res) => {
  res.json({ ready: true });
});

// ---------- Metrics endpoint scraped by Prometheus ----------
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ---------- Menu ----------
app.get('/api/menu', (req, res) => {
  res.json(store.getMenu());
});

// ---------- Orders ----------
app.get('/api/orders', (req, res) => {
  res.json(store.listOrders());
});

app.post('/api/orders', chaos, (req, res) => {
  const { studentName, items } = req.body || {};

  if (!studentName || typeof studentName !== 'string' || !studentName.trim()) {
    return res.status(400).json({ error: 'studentName is required' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items must be a non-empty array' });
  }
  for (const it of items) {
    const menuItem = store.findMenuItem(it.itemId);
    if (!menuItem) return res.status(400).json({ error: `Item ${it.itemId} not found` });
    if (!menuItem.available) return res.status(409).json({ error: `${menuItem.name} is sold out` });
    if (it.qty !== undefined && (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > 10)) {
      return res.status(400).json({ error: 'qty must be an integer between 1 and 10' });
    }
  }

  const order = store.createOrder(studentName.trim(), items);
  ordersPlacedTotal.inc();
  activeOrders.inc();
  logger.info('Order placed', { orderId: order.id, token: order.token, total: order.total });
  return res.status(201).json(order);
});

app.get('/api/orders/:id', (req, res) => {
  const order = store.getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  return res.json(order);
});

app.patch('/api/orders/:id/status', (req, res) => {
  const { status } = req.body || {};
  if (!store.VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${store.VALID_STATUSES.join(', ')}` });
  }
  const existing = store.getOrder(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Order not found' });

  const wasActive = !['COLLECTED', 'CANCELLED'].includes(existing.status);
  const order = store.updateStatus(req.params.id, status);
  const isActive = !['COLLECTED', 'CANCELLED'].includes(order.status);
  if (wasActive && !isActive) activeOrders.dec();
  if (!wasActive && isActive) activeOrders.inc();

  logger.info('Order status updated', { orderId: order.id, status });
  return res.json(order);
});

// ---------- 404 + error handlers ----------
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Internal server error' });
});

module.exports = app;
