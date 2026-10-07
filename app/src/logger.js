// Structured JSON logging (Pillar 2 of observability).
// Logs go to stdout; Promtail/Logstash in the cluster ships them to Loki/Elasticsearch.

function log(level, message, fields = {}) {
  if (process.env.NODE_ENV === 'test' && level !== 'error') return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'quickbite',
    version: process.env.APP_VERSION || 'dev',
    message,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else console.log(line);
}

module.exports = {
  info: (msg, f) => log('info', msg, f),
  warn: (msg, f) => log('warn', msg, f),
  error: (msg, f) => log('error', msg, f),
};
