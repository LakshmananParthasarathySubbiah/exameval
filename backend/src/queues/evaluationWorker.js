const { Worker } = require('bullmq');
const { Redis } = require('ioredis');
const { extractText } = require('../utils/extractText');
const { parseRubric } = require('../ai/rubricParser');
const { mapAnswers } = require('../ai/answerMapper');
const { aggregateResults } = require('../ai/evaluationAggregator');
const logger = require('../utils/logger');
const { sseEmit } = require('../utils/sseManager');
const { evaluationsTotal } = require('../utils/metrics');

const prisma = require('../utils/prisma');

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

connection.on('error', (err) =>
  logger.error('Redis worker connection error', { error: err.message })
);

const worker = new Worker(
  'evaluation',
  async (job) => {
    const { evaluationId, scriptId, examId } = job.data;
    logger.info(`Starting evaluation job: ${evaluationId}`, { scriptId, examId });

    const emit = (data) => sseEmit(evaluationId, data);

    try {
      // Verify evaluation record exists before updating
      const evaluation = await prisma.evaluation.findUnique({ where: { id: evaluationId } });
      if (!evaluation) {
        logger.warn(`Evaluation job ${evaluationId} discarded: record not found in database.`);
        return;
      }

      // Mark evaluation as PROCESSING
      await prisma.evaluation.update({
        where: { id: evaluationId },
        data: { status: 'PROCESSING' },
      });
      emit({ status: 'PROCESSING', message: 'Starting evaluation...' });

      // ── STEP 1: Get text ───────────────────────────────────────────
      const script = await prisma.script.findUnique({ where: { id: scriptId } });
      if (!script) {
        logger.warn(`Script ${scriptId} not found for evaluation ${evaluationId}. Marking evaluation as FAILED.`);
        await prisma.evaluation.update({
          where: { id: evaluationId },
          data: { status: 'FAILED' },
        }).catch(() => {});
        return;
      }

      await prisma.script.update({ where: { id: scriptId }, data: { status: 'PROCESSING' } });
      emit({ status: 'PROCESSING', message: 'Loading answer script...' });

      let text = script.extractedText;
      let ocrUsed = script.ocrUsed;

      // Use cached text if available, otherwise extract
      if (!text || text.length < 50) {
        logger.info(`No cached text found, extracting from file...`);
        emit({ status: 'PROCESSING', message: 'Extracting text from PDF...' });
        const result = await extractText(script.filePath);
        text = result.text;
        ocrUsed = result.ocrUsed;
        await prisma.script.update({
          where: { id: scriptId },
          data: { extractedText: text, ocrUsed, ocrMethod: result.ocrMethod, status: 'PROCESSING' },
        });
      } else {
        logger.info(`Using cached extracted text: ${text.length} chars`);
        emit({
          status: 'PROCESSING',
          message: `Text ready (${text.length} chars). Parsing rubric...`,
        });
      }

      // ── STEP 2: Parse rubric ───────────────────────────────────────
      const exam = await prisma.exam.findUnique({ where: { id: examId } });
      if (!exam) throw new Error(`Exam not found: ${examId}`);

      let rubricParsed = exam.rubricParsed;
      if (!rubricParsed || (Array.isArray(rubricParsed) && rubricParsed.length === 0)) {
        if (!exam.rubricText) throw new Error('No rubric text available for this exam');
        rubricParsed = await parseRubric(exam.rubricText);
        await prisma.exam.update({
          where: { id: examId },
          data: { rubricParsed },
        });
      }

      const questions = Array.isArray(rubricParsed) ? rubricParsed : [];
      logger.info(`Rubric ready: ${questions.length} questions`);
      emit({
        status: 'PROCESSING',
        message: 'Rubric parsed. Mapping student answers...',
        totalQuestions: questions.length,
      });

      // ── STEP 3: Map answers ────────────────────────────────────────
      const mappedAnswers = await mapAnswers(text);
      const answersMap = new Map(mappedAnswers.map((a) => [a.questionNumber, a.answerText]));
      emit({ status: 'PROCESSING', message: 'Answers mapped. Evaluating questions...' });

      // ── STEP 4: Evaluate each question ────────────────────────────
      emit({
        status: 'PROCESSING',
        message: 'Evaluating questions...',
        currentQuestion: 0,
        totalQuestions: questions.length,
      });

      const { evaluateQuestion } = require('../ai/questionEvaluator');
      const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_GROQ_CALLS || '5', 10);
      const questionResults = [];

      for (let i = 0; i < questions.length; i += MAX_CONCURRENT) {
        const batch = questions.slice(i, i + MAX_CONCURRENT);
        const batchResults = await Promise.all(
          batch.map(async (q, batchIdx) => {
            const globalIdx = i + batchIdx;
            emit({
              status: 'PROCESSING',
              message: `Evaluating ${q.questionNumber}...`,
              currentQuestion: globalIdx + 1,
              totalQuestions: questions.length,
            });
            return evaluateQuestion(q, answersMap.get(q.questionNumber) || null);
          })
        );
        questionResults.push(...batchResults);
      }

      emit({ status: 'PROCESSING', message: 'All questions evaluated. Aggregating...' });

      // ── STEP 5: Aggregate ──────────────────────────────────────────
      const { totalScore, maxScore, percentage, status, breakdown } =
        aggregateResults(questionResults);

      await prisma.evaluation.update({
        where: { id: evaluationId },
        data: {
          totalScore,
          maxScore,
          percentage,
          status,
          breakdown,
          updatedAt: new Date(),
        },
      });

      // Persist normalized per-question rows for analytics (idempotent on retry).
      await prisma.questionResult.deleteMany({ where: { evaluationId } });
      await prisma.questionResult.createMany({
        data: questionResults.map((q) => ({
          evaluationId,
          questionNumber: String(q.questionNumber),
          questionText: q.questionText || null,
          score: q.score,
          maxScore: q.maxScore,
          confidence: q.confidence,
          injectionFlagged: !!q.injectionFlagged,
        })),
      });

      await prisma.script.update({
        where: { id: scriptId },
        data: { status: 'EVALUATED' },
      });

      logger.info(
        `Evaluation ${evaluationId} complete: ${totalScore}/${maxScore} (${percentage}%) — ${status}`
      );

      emit({
        status,
        totalScore,
        maxScore,
        percentage,
        message:
          status === 'PENDING_REVIEW'
            ? 'Evaluation complete — flagged for review (low confidence)'
            : 'Evaluation complete!',
        currentQuestion: questions.length,
        totalQuestions: questions.length,
      });
    } catch (err) {
      logger.error(`Evaluation job failed: ${evaluationId}`, {
        error: err.message,
        stack: err.stack,
      });

      await prisma.evaluation
        .update({
          where: { id: evaluationId },
          data: { status: 'FAILED' },
        })
        .catch(() => {});

      await prisma.script
        .update({
          where: { id: scriptId },
          data: { status: 'FAILED' },
        })
        .catch(() => {});

      emit({ status: 'FAILED', message: err.message });
      throw err;
    }
  },
  {
    connection,
    concurrency: 3,
  }
);

worker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed`);
  evaluationsTotal.inc({ status: 'completed' });
});

worker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed`, { error: err.message });
  evaluationsTotal.inc({ status: 'failed' });
});

worker.on('error', (err) => {
  logger.error('Worker error', { error: err.message });
});

logger.info('Evaluation worker started');

module.exports = { worker, connection };
