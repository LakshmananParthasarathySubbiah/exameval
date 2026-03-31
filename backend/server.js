require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const logger = require('./src/utils/logger');
const { errorHandler } = require('./src/middleware/errorHandler');
const { startHeartbeat } = require('./src/utils/sseManager');

// Routes
const authRoutes = require('./src/routes/authRoutes');
const courseRoutes = require('./src/routes/courseRoutes');
const examRoutes = require('./src/routes/examRoutes');
const studentRoutes = require('./src/routes/studentRoutes');
const scriptRoutes = require('./src/routes/scriptRoutes');
const evaluationRoutes = require('./src/routes/evaluationRoutes');
const auditRoutes = require('./src/routes/auditRoutes');

// Start BullMQ worker
require('./src/queues/evaluationWorker');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & parsing
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging via winston
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_DIR || './uploads')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/scripts', scriptRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/audit', auditRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use(errorHandler);

// Start SSE heartbeat
startHeartbeat();

app.listen(PORT, () => {
  logger.info(`ExamEval server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;
