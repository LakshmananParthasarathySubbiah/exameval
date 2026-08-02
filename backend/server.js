require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const logger = require('./src/utils/logger');
const { loadConfig } = require('./src/config');

// Fail fast if required secrets are missing; warn on recommended ones.
const config = loadConfig();
if (config.recommendedMissing.length) {
  logger.warn(
    `Missing recommended env vars: ${config.recommendedMissing.join(', ')} — related features may be degraded.`
  );
}

const prisma = require('./src/utils/prisma');
const { errorHandler } = require('./src/middleware/errorHandler');
const { startHeartbeat, closeAllClients } = require('./src/utils/sseManager');
const { evaluationQueue, connection: queueConnection } = require('./src/queues/evaluationQueue');
const { apiLimiter } = require('./src/middleware/rateLimit');
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./src/docs/openapi');
const { register: metricsRegister, metricsMiddleware } = require('./src/utils/metrics');

// Routes
const authRoutes = require('./src/routes/authRoutes');
const courseRoutes = require('./src/routes/courseRoutes');
const examRoutes = require('./src/routes/examRoutes');
const studentRoutes = require('./src/routes/studentRoutes');
const scriptRoutes = require('./src/routes/scriptRoutes');
const evaluationRoutes = require('./src/routes/evaluationRoutes');
const auditRoutes = require('./src/routes/auditRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes');
const assistantRoutes = require('./src/routes/assistantRoutes');

// Start BullMQ worker
const { worker, connection: workerConnection } = require('./src/queues/evaluationWorker');

const app = express();
const PORT = config.port;

// Trust the first proxy in production (Vercel/Render/nginx) so rate limiting
// and req.ip key off the real client IP, not the proxy.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security & parsing
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging via winston
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  })
);

// Prometheus request metrics (before routes so every request is timed)
app.use(metricsMiddleware);

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, config.uploadDir)));

// Metrics scrape endpoint (outside /api so it isn't rate-limited)
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', metricsRegister.contentType);
  res.end(await metricsRegister.metrics());
});

// API docs (mounted before the rate limiter so the UI assets aren't throttled)
app.get('/api/docs.json', (req, res) => res.json(openapiSpec));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

// Global API rate limit (defense-in-depth; auth + evaluation have stricter limits)
app.use('/api', apiLimiter);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/scripts', scriptRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/assistant', assistantRoutes);

// Deep health check — verifies DB + Redis connectivity, not just liveness.
app.get('/api/health', async (req, res) => {
  const checks = { db: 'down', redis: 'down' };
  await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`.then(() => {
      checks.db = 'up';
    }),
    queueConnection.ping().then((r) => {
      checks.redis = r === 'PONG' ? 'up' : 'down';
    }),
  ]);
  const healthy = checks.db === 'up' && checks.redis === 'up';
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    data: { status: healthy ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() },
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use(errorHandler);

// Start SSE heartbeat
const heartbeat = startHeartbeat();

const server = app.listen(PORT, () => {
  logger.info(`ExamEval server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

// ── Graceful shutdown ─────────────────────────────────────────────
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received — shutting down gracefully...`);

  // Force-exit if cleanup hangs
  const forceTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 15000);
  forceTimer.unref();

  try {
    clearInterval(heartbeat);
    closeAllClients();

    // Stop accepting new HTTP connections
    await new Promise((resolve) => server.close(resolve));
    logger.info('HTTP server closed');

    // Stop processing jobs, then tear down queue + Redis connections
    await worker.close();
    await evaluationQueue.close();
    await Promise.allSettled([queueConnection.quit(), workerConnection.quit()]);
    logger.info('Worker, queue, and Redis connections closed');

    await prisma.$disconnect();
    logger.info('Prisma disconnected');

    clearTimeout(forceTimer);
    process.exit(0);
  } catch (err) {
    logger.error('Error during graceful shutdown', { error: err.message });
    process.exit(1);
  }
}

['SIGTERM', 'SIGINT'].forEach((signal) => {
  process.on(signal, () => shutdown(signal));
});

module.exports = app;
