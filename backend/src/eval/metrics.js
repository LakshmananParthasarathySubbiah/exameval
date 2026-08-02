/**
 * Pure metrics for evaluating the AI grader against human ground truth.
 *
 * Every function takes plain arrays/pairs and returns numbers — no I/O — so the
 * harness output is reproducible and the math is unit-tested. A "pair" is
 * { human, ai } (and optionally maxScore) for one graded question.
 *
 * These answer the #1 question an AI interviewer asks: "How good is your grader,
 * with numbers?" — MAE, RMSE, correlation, % within tolerance, pass/fail F1.
 */

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function round(n, d = 4) {
  if (n == null || Number.isNaN(n)) return null;
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

/** Mean Absolute Error between AI and human scores. */
function mae(pairs) {
  if (!pairs.length) return null;
  return round(mean(pairs.map((p) => Math.abs(p.ai - p.human))));
}

/** Root Mean Squared Error. */
function rmse(pairs) {
  if (!pairs.length) return null;
  return round(Math.sqrt(mean(pairs.map((p) => (p.ai - p.human) ** 2))));
}

/** Pearson correlation between AI and human scores. */
function pearson(pairs) {
  const n = pairs.length;
  if (n < 2) return null;
  const h = pairs.map((p) => p.human);
  const a = pairs.map((p) => p.ai);
  const mh = mean(h);
  const ma = mean(a);
  let num = 0;
  let dh = 0;
  let da = 0;
  for (let i = 0; i < n; i++) {
    const x = h[i] - mh;
    const y = a[i] - ma;
    num += x * y;
    dh += x * x;
    da += y * y;
  }
  const den = Math.sqrt(dh * da);
  return den === 0 ? 0 : round(num / den);
}

/** Spearman rank correlation (robust to non-linear-but-monotonic agreement). */
function spearman(pairs) {
  const n = pairs.length;
  if (n < 2) return null;
  const rank = (vals) => {
    const idx = vals.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
    const ranks = new Array(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1; // average rank for ties (1-based)
      for (let k = i; k <= j; k++) ranks[idx[k][1]] = avg;
      i = j + 1;
    }
    return ranks;
  };
  const hr = rank(pairs.map((p) => p.human));
  const ar = rank(pairs.map((p) => p.ai));
  return pearson(hr.map((h, i) => ({ human: h, ai: ar[i] })));
}

/** Fraction of questions where |ai - human| <= tolerance marks. */
function withinTolerance(pairs, tolerance = 1) {
  if (!pairs.length) return null;
  return round(mean(pairs.map((p) => (Math.abs(p.ai - p.human) <= tolerance ? 1 : 0))));
}

/**
 * Pass/fail confusion treating "pass" as proportion >= passRatio of maxScore.
 * Falls back to absolute passMark if maxScore is absent.
 */
function passFailConfusion(pairs, { passRatio = 0.4 } = {}) {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (const p of pairs) {
    const max = p.maxScore || 0;
    const threshold = max > 0 ? passRatio * max : 0;
    const humanPass = p.human >= threshold;
    const aiPass = p.ai >= threshold;
    if (humanPass && aiPass) tp++;
    else if (!humanPass && aiPass) fp++;
    else if (!humanPass && !aiPass) tn++;
    else fn++;
  }
  const total = tp + fp + tn + fn;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return {
    tp,
    fp,
    tn,
    fn,
    accuracy: total ? round((tp + tn) / total) : null,
    precision: round(precision),
    recall: round(recall),
    f1: round(f1),
  };
}

/** Full scorecard over a set of {human, ai, maxScore} pairs. */
function scorecard(pairs, opts = {}) {
  return {
    n: pairs.length,
    mae: mae(pairs),
    rmse: rmse(pairs),
    pearson: pearson(pairs),
    spearman: spearman(pairs),
    withinOneMark: withinTolerance(pairs, opts.tolerance ?? 1),
    passFail: passFailConfusion(pairs, opts),
  };
}

module.exports = {
  mean,
  round,
  mae,
  rmse,
  pearson,
  spearman,
  withinTolerance,
  passFailConfusion,
  scorecard,
};
