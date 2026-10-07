require('./tracing'); // must be first so OpenTelemetry can instrument express/http
const app = require('./app');
const logger = require('./logger');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info('QuickBite service started', { port: PORT });
});

// Graceful shutdown so rolling updates don't drop in-flight requests
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});
