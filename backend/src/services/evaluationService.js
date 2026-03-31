const { PrismaClient } = require('@prisma/client');
const { enqueueEvaluation } = require('../queues/evaluationQueue');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

async function getEvaluations({ page = 1, limit = 20, examId, status }) {
  const skip = (page - 1) * limit;

  // Build where via script → exam relationship
  const where = {};
  if (examId || status) {
    if (examId) where.script = { examId };
    if (status) where.status = status;
  }

  const [evaluations, total] = await Promise.all([
    prisma.evaluation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        script: {
          include: {
            student: { select: { name: true, rollNumber: true } },
            exam: { select: { title: true, id: true } },
          },
        },
      },
    }),
    prisma.evaluation.count({ where }),
  ]);

  return { evaluations, pagination: { page, limit, total } };
}

async function getEvaluationById(id) {
  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    include: {
      script: {
        include: {
          student: { select: { name: true, rollNumber: true, email: true } },
          exam: { select: { title: true, date: true } },
        },
      },
      overrider: { select: { email: true, role: true } },
      auditLogs: {
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, role: true } } },
      },
    },
  });

  if (!evaluation) {
    const err = new Error('Evaluation not found');
    err.status = 404;
    throw err;
  }
  return evaluation;
}

async function runEvaluation(scriptId, userId) {
  const script = await prisma.script.findUnique({
    where: { id: scriptId },
    include: { exam: true },
  });

  if (!script) {
    const err = new Error('Script not found');
    err.status = 404;
    throw err;
  }

  // Create evaluation record
  const evaluation = await prisma.evaluation.create({
    data: { scriptId, status: 'PENDING' },
  });

  // Enqueue job
  await enqueueEvaluation({
    evaluationId: evaluation.id,
    scriptId,
    examId: script.examId,
  });

  logger.info(`Evaluation queued: ${evaluation.id} for script ${scriptId}`);
  return evaluation;
}

async function runBatchEvaluation(scriptIds, userId) {
  const results = [];
  for (const scriptId of scriptIds) {
    try {
      const evaluation = await runEvaluation(scriptId, userId);
      results.push({ scriptId, evaluationId: evaluation.id, success: true });
    } catch (err) {
      results.push({ scriptId, success: false, error: err.message });
    }
  }
  return results;
}

async function retryEvaluation(id) {
  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    include: { script: { select: { examId: true } } },
  });

  if (!evaluation) {
    const err = new Error('Evaluation not found');
    err.status = 404;
    throw err;
  }

  if (evaluation.status !== 'FAILED') {
    const err = new Error('Only FAILED evaluations can be retried');
    err.status = 400;
    throw err;
  }

  await prisma.evaluation.update({ where: { id }, data: { status: 'PENDING' } });
  await enqueueEvaluation({
    evaluationId: id,
    scriptId: evaluation.scriptId,
    examId: evaluation.script.examId,
  });

  return { message: 'Retry enqueued' };
}

async function reviewEvaluation(id, { overrideScore, staffNotes, staffReviewed }, userId) {
  const evaluation = await prisma.evaluation.findUnique({ where: { id } });
  if (!evaluation) {
    const err = new Error('Evaluation not found');
    err.status = 404;
    throw err;
  }

  const updateData = { staffReviewed: staffReviewed ?? evaluation.staffReviewed };
  if (staffNotes !== undefined) updateData.staffNotes = staffNotes;

  let prevScore = evaluation.overrideScore ?? evaluation.totalScore;
  let newScore = prevScore;

  if (overrideScore !== undefined && overrideScore !== null) {
    updateData.overrideScore = overrideScore;
    updateData.overriddenBy = userId;
    updateData.overriddenAt = new Date();
    newScore = overrideScore;
  }

  if (staffReviewed && evaluation.status === 'PENDING_REVIEW') {
    updateData.status = 'COMPLETED';
  }

  const updated = await prisma.evaluation.update({ where: { id }, data: updateData });

  // Write audit log
  await prisma.auditLog.create({
    data: {
      evaluationId: id,
      userId,
      action: overrideScore !== undefined ? 'SCORE_OVERRIDE' : 'STAFF_REVIEW',
      prevScore,
      newScore,
      reason: staffNotes || null,
    },
  });

  logger.info(`Evaluation ${id} reviewed by user ${userId}`);
  return updated;
}

async function getExamSummary(examId) {
  const evaluations = await prisma.evaluation.findMany({
    where: { script: { examId } },
    select: { status: true, percentage: true, staffReviewed: true },
  });

  const total = evaluations.length;
  const completed = evaluations.filter((e) => e.status === 'COMPLETED' || e.status === 'PENDING_REVIEW').length;
  const pendingReview = evaluations.filter((e) => e.status === 'PENDING_REVIEW').length;
  const avgScore = completed > 0
    ? evaluations
        .filter((e) => e.percentage != null)
        .reduce((sum, e) => sum + e.percentage, 0) / (completed || 1)
    : 0;

  return { total, completed, pendingReview, avgScore: Math.round(avgScore * 100) / 100 };
}

module.exports = {
  getEvaluations,
  getEvaluationById,
  runEvaluation,
  runBatchEvaluation,
  retryEvaluation,
  reviewEvaluation,
  getExamSummary,
};
