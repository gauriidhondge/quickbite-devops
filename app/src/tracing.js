// Distributed tracing with OpenTelemetry (Pillar 3 of observability).
// Enabled only when OTEL_ENABLED=true. Spans are exported over OTLP/HTTP to Jaeger.
// Must be loaded BEFORE express so instrumentation can patch it.

if (process.env.OTEL_ENABLED === 'true') {
  try {
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
    const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');

    const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://jaeger.observability:4318';

    const sdk = new NodeSDK({
      serviceName: process.env.OTEL_SERVICE_NAME || 'quickbite',
      traceExporter: new OTLPTraceExporter({ url: `${base}/v1/traces` }),
      instrumentations: [new HttpInstrumentation(), new ExpressInstrumentation()],
    });
    sdk.start();
    console.log(JSON.stringify({ level: 'info', message: 'OpenTelemetry tracing started', endpoint: base }));
    process.on('SIGTERM', () => sdk.shutdown());
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', message: 'Tracing init failed', error: err.message }));
  }
}
