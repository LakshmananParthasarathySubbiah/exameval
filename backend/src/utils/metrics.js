/**
 * Prometheus metrics (O1 observability).
 *
 * Exposes a registry scraped at GET /metrics, plus app-specific instruments:
 * request latency/count, evaluation outcomes, queue depth, and LLM token spend
 * (the cost signal that matters for an AI product). Default Node/process
 * metrics (event-loop lag, heap, GC) are collected too.
 */
const client = require('prom-client');

const register = new client.Registry();
register.setDefaultLabels({ app: 'exameval' });
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const evaluationsTotal = new client.Counter({
  name: 'evaluations_total',
  help: 'Evaluations processed by the worker',
  labelNames: ['status'],
  registers: [register],
});

const queueDepth = new client.Gauge({
  name: 'evaluation_queue_depth',
  help: 'Waiting + active jobs in the evaluation queue',
  registers: [register],
});

const llmTokensTotal = new client.Counter({
  name: 'llm_tokens_total',
  help: 'LLM tokens consumed',
  labelNames: ['label'],
  registers: [register],
});

/** Express middleware: times every request and records count + latency. */
function metricsMiddleware(req, res, next) {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    // Use the matched route template (not the raw path) to keep label cardinality low.
    const route = (req.baseUrl || '') + (req.route?.path || '') || req.path || 'unknown';
    const labels = { method: req.method, route, status: res.statusCode };
    end(labels);
    httpRequestsTotal.inc(labels);
  });
  next();
}

module.exports = {
  client,
  register,
  metricsMiddleware,
  httpRequestDuration,
  httpRequestsTotal,
  evaluationsTotal,
  queueDepth,
  llmTokensTotal,
};
