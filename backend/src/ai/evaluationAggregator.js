const logger = require('../utils/logger');

const CONFIDENCE_THRESHOLD = 0.6;

/**
 * Aggregate per-question results into final evaluation.
 * @param {Array} questionResults - Array of individual question evaluations
 * @returns {object} { totalScore, maxScore, percentage, status, breakdown }
 */
function aggregateResults(questionResults) {
  let totalScore = 0;
  let maxScore = 0;
  let hasPendingReview = false;

  for (const result of questionResults) {
    totalScore += result.score;
    maxScore += result.maxScore;

    if (result.confidence < CONFIDENCE_THRESHOLD) {
      hasPendingReview = true;
      logger.info(
        `Low confidence (${result.confidence}) on ${result.questionNumber} — flagging for review`
      );
    }
  }

  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

  const status = hasPendingReview ? 'PENDING_REVIEW' : 'COMPLETED';

  logger.info(
    `Aggregation complete: ${totalScore}/${maxScore} (${percentage.toFixed(1)}%) — status: ${status}`
  );

  return {
    totalScore,
    maxScore,
    percentage: Math.round(percentage * 100) / 100,
    status,
    breakdown: questionResults,
  };
}

module.exports = { aggregateResults };
