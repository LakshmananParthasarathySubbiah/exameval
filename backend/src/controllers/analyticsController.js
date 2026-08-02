const prisma = require('../utils/prisma');
const analytics = require('../services/analyticsService');
const { getOrSet, cacheKey } = require('../utils/cache');

/**
 * Compute aggregate analytics for one exam from the normalized QuestionResult
 * rows. Pure-ish (only reads DB); separated so it can be cached.
 */
async function computeExamAnalytics(examId) {
  const evaluations = await prisma.evaluation.findMany({
    where: { script: { examId } },
    select: {
      id: true,
      percentage: true,
      status: true,
      overrideScore: true,
      questionResults: {
        select: {
          questionNumber: true,
          score: true,
          maxScore: true,
          confidence: true,
          injectionFlagged: true,
        },
      },
    },
  });

  const rows = [];
  for (const e of evaluations) {
    for (const q of e.questionResults) {
      rows.push({
        evaluationId: e.id,
        questionNumber: q.questionNumber,
        score: q.score,
        maxScore: q.maxScore,
        confidence: q.confidence,
      });
    }
  }

  const percentages = evaluations.filter((e) => e.percentage != null).map((e) => e.percentage);

  const meanConfidences = [];
  const overriddenFlags = [];
  for (const e of evaluations) {
    const confs = e.questionResults.map((q) => q.confidence);
    meanConfidences.push(confs.length ? analytics.mean(confs) : 0);
    overriddenFlags.push(e.overrideScore != null ? 1 : 0);
  }

  const injectionFlaggedQuestions = evaluations.reduce(
    (a, e) => a + e.questionResults.filter((q) => q.injectionFlagged).length,
    0
  );

  return {
    summary: {
      totalEvaluations: evaluations.length,
      completed: evaluations.filter((e) => ['COMPLETED', 'PENDING_REVIEW'].includes(e.status))
        .length,
      pendingReview: evaluations.filter((e) => e.status === 'PENDING_REVIEW').length,
      overrides: overriddenFlags.reduce((a, b) => a + b, 0),
      averagePercentage: percentages.length ? analytics.round(analytics.mean(percentages), 2) : 0,
      injectionFlaggedQuestions,
      confidenceVsOverrideCorrelation: analytics.round(
        analytics.pearson(meanConfidences, overriddenFlags)
      ),
      reliabilityCronbachAlpha: analytics.cronbachAlpha(rows),
    },
    scoreDistribution: analytics.scoreDistribution(percentages),
    itemAnalysis: analytics.itemAnalysis(rows),
  };
}

/**
 * GET /api/analytics/exam/:examId
 * Cached 30s in Redis (fail-open) — heavy aggregation over all evaluations.
 */
async function getExamAnalytics(req, res, next) {
  try {
    const { examId } = req.params;
    const data = await getOrSet(cacheKey('analytics', examId), 30, () =>
      computeExamAnalytics(examId)
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getExamAnalytics, computeExamAnalytics };
