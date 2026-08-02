/**
 * Confidence-calibration model (ML2).
 *
 * A dependency-free logistic-regression trainer that predicts whether a human
 * will OVERRIDE the AI's score for an evaluation — so the review queue can be
 * ranked riskiest-first. Pure JS (gradient descent) so it trains/tests without
 * Python; see ml/train_calibration.py for the sklearn equivalent on real data.
 *
 * Features (per evaluation), see `featuresFromEvaluation`:
 *   [ meanConfidence, minConfidence, answerLengthNorm, ocrUsed, injectionFlagged ]
 * Target: 1 if staff overrode the score, else 0.
 */

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * Train logistic regression via batch gradient descent.
 * @param {number[][]} X feature rows
 * @param {number[]} y labels (0/1)
 * @returns {{ w:number[], b:number, predictProba:Function, predict:Function }}
 */
function train(X, y, { lr = 0.3, epochs = 800, l2 = 0.0 } = {}) {
  const n = X.length;
  const d = n ? X[0].length : 0;
  let w = new Array(d).fill(0);
  let b = 0;

  for (let e = 0; e < epochs; e++) {
    const gw = new Array(d).fill(0);
    let gb = 0;
    for (let i = 0; i < n; i++) {
      const p = sigmoid(dot(w, X[i]) + b);
      const err = p - y[i];
      for (let j = 0; j < d; j++) gw[j] += err * X[i][j];
      gb += err;
    }
    for (let j = 0; j < d; j++) w[j] -= lr * (gw[j] / n + l2 * w[j]);
    b -= lr * (gb / n);
  }

  const model = { w, b };
  model.predictProba = (x) => sigmoid(dot(w, x) + b);
  model.predict = (x, threshold = 0.5) => (model.predictProba(x) >= threshold ? 1 : 0);
  return model;
}

/** Rank-based ROC-AUC (Mann–Whitney). Returns 0.5 for degenerate input. */
function rocAuc(yTrue, yScore) {
  const pos = [];
  const neg = [];
  for (let i = 0; i < yTrue.length; i++) (yTrue[i] === 1 ? pos : neg).push(yScore[i]);
  if (!pos.length || !neg.length) return 0.5;
  // average rank of positives among all scores
  const paired = yScore.map((s, i) => ({ s, y: yTrue[i] })).sort((a, b) => a.s - b.s);
  let rankSum = 0;
  for (let i = 0; i < paired.length; i++) {
    if (paired[i].y === 1) rankSum += i + 1; // 1-based rank (ties ignored for simplicity)
  }
  const nPos = pos.length;
  const nNeg = neg.length;
  return (rankSum - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

/**
 * Map an evaluation's question results into a feature vector.
 * @param {{ questionResults:Array, ocrUsed?:boolean }} ev
 */
function featuresFromEvaluation(ev) {
  const qs = ev.questionResults || [];
  const confs = qs.map((q) => q.confidence ?? 1);
  const meanConfidence = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 1;
  const minConfidence = confs.length ? Math.min(...confs) : 1;
  const totalLen = qs.reduce((a, q) => a + ((q.studentAnswer || '').length || 0), 0);
  const answerLengthNorm = Math.min(totalLen / 2000, 1); // cap/normalize
  const ocrUsed = ev.ocrUsed ? 1 : 0;
  const injectionFlagged = qs.some((q) => q.injectionFlagged) ? 1 : 0;
  return [meanConfidence, minConfidence, answerLengthNorm, ocrUsed, injectionFlagged];
}

module.exports = { sigmoid, train, rocAuc, featuresFromEvaluation };
