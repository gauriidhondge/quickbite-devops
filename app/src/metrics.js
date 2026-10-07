// Prometheus metrics (Pillar 1 of observability).
const client = require('prom-client');

const register = new client.Registry();
register.setDefaultLabels({ app: 'quickbite' });
client.collectDefaultMetrics({ register }); // CPU, memory, event loop lag, GC...

// SLI: request count by route + status code -> availability / error rate
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// SLI: latency histogram -> p95 latency
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

// Business metric
const ordersPlacedTotal = new client.Counter({
  name: 'quickbite_orders_placed_total',
  help: 'Total canteen orders placed',
  registers: [register],
});

const activeOrders = new client.Gauge({
  name: 'quickbite_active_orders',
  help: 'Orders not yet collected or cancelled',
  registers: [register],
});

function metricsMiddleware(req, res, next) {
  if (req.path === '/metrics') return next();
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    // Use the matched route pattern (e.g. /orders/:id) to keep label cardinality low
    const route = req.route ? req.baseUrl + req.route.path : 'unmatched';
    const labels = { method: req.method, route, status_code: res.statusCode };
    httpRequestsTotal.inc(labels);
    end(labels);
  });
  next();
}

module.exports = {
  register,
  metricsMiddleware,
  ordersPlacedTotal,
  activeOrders,
};
