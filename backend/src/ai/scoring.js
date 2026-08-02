/**
 * Pure scoring helpers — no I/O, no logging — so they are trivial to test
 * and reuse. The impure aggregator (which logs) delegates to `aggregate`.
 */

const CONFIDENCE_THRESHOLD = 0.6;

/** Clamp a value into [lo, hi], coercing non-numbers to 0. */
function clamp(value, lo, hi) {
  const n = Number(value);
  return Math.min(Math.max(Number.isFinite(n) ? n : 0, lo), hi);
}

/**
 * Aggregate per-question results into a final evaluation.
 * Any question whose confidence is below `threshold` flags the whole
 * evaluation for human review (PENDING_REVIEW).
 */
function aggregate(questionResults, threshold = CONFIDENCE_THRESHOLD) {
  let totalScore = 0;
  let maxScore = 0;
  const lowConfidence = [];

  for (const r of questionResults) {
    totalScore += Number(r.score) || 0;
    maxScore += Number(r.maxScore) || 0;
    if ((Number(r.confidence) || 0) < threshold) lowConfidence.push(r.questionNumber);
  }

  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

  return {
    totalScore,
    maxScore,
    percentage: Math.round(percentage * 100) / 100,
    status: lowConfidence.length > 0 ? 'PENDING_REVIEW' : 'COMPLETED',
    lowConfidence,
    breakdown: questionResults,
  };
}

module.exports = { clamp, aggregate, CONFIDENCE_THRESHOLD };
