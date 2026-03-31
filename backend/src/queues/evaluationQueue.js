const { Queue } = require('bullmq');
const { Redis } = require('ioredis');
const logger = require('../utils/logger');

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

connection.on('error', (err) => logger.error('Redis connection error', { error: err.message }));
connection.on('connect', () => logger.info('Redis connected for BullMQ queue'));

const evaluationQueue = new Queue('evaluation', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/**
 * Add an evaluation job to the queue.
 * @param {{ evaluationId, scriptId, examId }} jobData
 * @returns {Job} BullMQ job
 */
async function enqueueEvaluation(jobData) {
  const job = await evaluationQueue.add('evaluate', jobData, {
    jobId: `eval-${jobData.evaluationId}`,
  });
  logger.info(`Evaluation job enqueued: ${job.id}`, jobData);
  return job;
}

module.exports = { evaluationQueue, enqueueEvaluation, connection };
