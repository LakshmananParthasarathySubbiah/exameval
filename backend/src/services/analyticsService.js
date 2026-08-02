/**
 * Assessment analytics (psychometrics).
 *
 * Every function here is PURE — it takes plain arrays/objects and returns
 * numbers, no Prisma, no I/O. That keeps the statistics trivially unit-testable
 * and means the exact same math powers the API and the test fixtures.
 *
 * A "row" is one per-question result for one student:
 *   { evaluationId, questionNumber, score, maxScore, confidence }
 */

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function variance(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return mean(xs.map((x) => (x - m) ** 2));
}

function round(n, digits = 4) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** Pearson correlation. Returns 0 for degenerate input (zero variance / mismatch). */
function pearson(xs, ys) {
  const n = xs.length;
  if (n === 0 || n !== ys.length) return 0;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

/**
 * Per-question difficulty + discrimination.
 *  - difficulty    = mean proportion correct (0..1). Higher = easier.
 *  - discrimination = point-biserial correlation between a student's proportion
 *    on this item and their overall exam proportion. Higher = better at
 *    separating strong/weak students. (>0.3 good, <0.1 poor.)
 */
function itemAnalysis(rows) {
  // Each student's overall proportion (total earned / total possible).
  const byEval = new Map();
  for (const r of rows) {
    if (!byEval.has(r.evaluationId)) byEval.set(r.evaluationId, { earned: 0, possible: 0 });
    const acc = byEval.get(r.evaluationId);
    acc.earned += r.score;
    acc.possible += r.maxScore;
  }
  const evalProportion = new Map();
  for (const [k, { earned, possible }] of byEval) {
    evalProportion.set(k, possible > 0 ? earned / possible : 0);
  }

  // Group by question.
  const byQ = new Map();
  for (const r of rows) {
    if (!byQ.has(r.questionNumber)) byQ.set(r.questionNumber, []);
    byQ.get(r.questionNumber).push(r);
  }

  const out = [];
  for (const [questionNumber, qrows] of byQ) {
    const props = qrows.map((r) => (r.maxScore > 0 ? r.score / r.maxScore : 0));
    const totals = qrows.map((r) => evalProportion.get(r.evaluationId) || 0);
    out.push({
      questionNumber,
      n: qrows.length,
      meanScore: round(mean(qrows.map((r) => r.score)), 2),
      maxScore: qrows[0].maxScore,
      difficulty: round(mean(props)),
      discrimination: round(pearson(props, totals)),
    });
  }
  return out.sort((a, b) =>
    String(a.questionNumber).localeCompare(String(b.questionNumber), undefined, { numeric: true })
  );
}

/**
 * Cronbach's alpha — internal-consistency reliability of the exam (0..1).
 * Returns null when undefined (fewer than 2 items or fewer than 2 students).
 */
function cronbachAlpha(rows) {
  const byEval = new Map();
  const questionSet = new Set();
  for (const r of rows) {
    questionSet.add(r.questionNumber);
    if (!byEval.has(r.evaluationId)) byEval.set(r.evaluationId, {});
    byEval.get(r.evaluationId)[r.questionNumber] = r.score;
  }
  const items = [...questionSet];
  const students = [...byEval.values()];
  const k = items.length;
  if (k < 2 || students.length < 2) return null;

  let sumItemVar = 0;
  for (const it of items) {
    sumItemVar += variance(students.map((s) => s[it] ?? 0));
  }
  const totals = students.map((s) => items.reduce((a, it) => a + (s[it] ?? 0), 0));
  const totalVar = variance(totals);
  if (totalVar === 0) return 0;
  return round((k / (k - 1)) * (1 - sumItemVar / totalVar));
}

/** Histogram of percentage scores into 10-point buckets. */
function scoreDistribution(percentages) {
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    range: i === 9 ? '90-100' : `${i * 10}-${i * 10 + 9}`,
    count: 0,
  }));
  for (const p of percentages) {
    let idx = Math.floor((Number(p) || 0) / 10);
    if (idx > 9) idx = 9;
    if (idx < 0) idx = 0;
    buckets[idx].count++;
  }
  return buckets;
}

module.exports = {
  mean,
  variance,
  pearson,
  round,
  itemAnalysis,
  cronbachAlpha,
  scoreDistribution,
};
