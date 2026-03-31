const { Worker } = require('bullmq');
const { Redis } = require('ioredis');
const { PrismaClient } = require('@prisma/client');
const { extractText } = require('../utils/extractText');
const { parseRubric } = require('../ai/rubricParser');
const { mapAnswers } = require('../ai/answerMapper');
const { evaluateAllQuestions } = require('../ai/questionEvaluator');
const { aggregateResults } = require('../ai/evaluationAggregator');
const logger = require('../utils/logger');
const { sseEmit } = require('../utils/sseManager');

const prisma = new PrismaClient();

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

connection.on('error', (err) => logger.error('Redis worker connection error', { error: err.message }));

const worker = new Worker(
  'evaluation',
  async (job) => {
    const { evaluationId, scriptId, examId } = job.data;
    logger.info(`Starting evaluation job: ${evaluationId}`, { scriptId, examId });

    const emit = (data) => sseEmit(evaluationId, data);

    try {
      // Mark evaluation as PROCESSING
      await prisma.evaluation.update({
        where: { id: evaluationId },
        data: { status: 'PROCESSING' },
      });
      emit({ status: 'PROCESSING', message: 'Starting evaluation...' });

      // ── STEP 1: Extract text ───────────────────────────────────────────
      const script = await prisma.script.findUnique({ where: { id: scriptId } });
      if (!script) throw new Error(`Script not found: ${scriptId}`);

      await prisma.script.update({ where: { id: scriptId }, data: { status: 'PROCESSING' } });
      emit({ status: 'PROCESSING', message: 'Extracting text from PDF...' });

      const { text, ocrUsed } = await extractText(script.filePath);
      await prisma.script.update({
        where: { id: scriptId },
        data: { extractedText: text, ocrUsed, status: 'PROCESSING' },
      });

      logger.info(`Text extracted for script ${scriptId}, OCR: ${ocrUsed}`);
      emit({ status: 'PROCESSING', message: 'Text extracted. Parsing rubric...' });

      // ── STEP 2: Parse rubric ───────────────────────────────────────────
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
      emit({ status: 'PROCESSING', message: 'Rubric parsed. Mapping student answers...', totalQuestions: questions.length });

      // ── STEP 3: Map answers ────────────────────────────────────────────
      const mappedAnswers = await mapAnswers(text);
      const answersMap = new Map(mappedAnswers.map((a) => [a.questionNumber, a.answerText]));
      emit({ status: 'PROCESSING', message: 'Answers mapped. Evaluating questions...' });

      // ── STEP 4: Evaluate each question ────────────────────────────────
      const questionResults = await Promise.all(
        questions.map(async (q, idx) => {
          const answer = answersMap.get(q.questionNumber) || null;
          // Import evaluateQuestion here to emit progress per question
          const { evaluateQuestion } = require('../ai/questionEvaluator');

          emit({
            status: 'PROCESSING',
            message: `Evaluating ${q.questionNumber}...`,
            currentQuestion: idx + 1,
            totalQuestions: questions.length,
          });

          return evaluateQuestion(q, answer);
        })
      );

      emit({ status: 'PROCESSING', message: 'All questions evaluated. Aggregating...' });

      // ── STEP 5: Aggregate ──────────────────────────────────────────────
      const { totalScore, maxScore, percentage, status, breakdown } = aggregateResults(questionResults);

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

      await prisma.script.update({
        where: { id: scriptId },
        data: { status: 'EVALUATED' },
      });

      logger.info(`Evaluation ${evaluationId} complete: ${totalScore}/${maxScore} (${percentage}%) — ${status}`);

      emit({
        status,
        totalScore,
        maxScore,
        percentage,
        message: status === 'PENDING_REVIEW'
          ? 'Evaluation complete — flagged for review (low confidence)'
          : 'Evaluation complete!',
        currentQuestion: questions.length,
        totalQuestions: questions.length,
      });

    } catch (err) {
      logger.error(`Evaluation job failed: ${evaluationId}`, { error: err.message, stack: err.stack });

      await prisma.evaluation.update({
        where: { id: evaluationId },
        data: { status: 'FAILED' },
      }).catch(() => {});

      await prisma.script.update({
        where: { id: scriptId },
        data: { status: 'FAILED' },
      }).catch(() => {});

      emit({ status: 'FAILED', message: err.message });
      throw err; // Let BullMQ handle retries
    }
  },
  {
    connection,
    concurrency: 3,
  }
);

worker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed`, { error: err.message });
});

worker.on('error', (err) => {
  logger.error('Worker error', { error: err.message });
});

logger.info('Evaluation worker started');

module.exports = { worker };
