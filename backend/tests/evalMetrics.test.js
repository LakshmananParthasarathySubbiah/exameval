const {
  mae,
  rmse,
  pearson,
  spearman,
  withinTolerance,
  passFailConfusion,
  scorecard,
} = require('../src/eval/metrics');

const perfect = [
  { human: 8, ai: 8, maxScore: 10 },
  { human: 5, ai: 5, maxScore: 10 },
  { human: 9, ai: 9, maxScore: 10 },
];

const close = [
  { human: 8, ai: 8, maxScore: 10 },
  { human: 5, ai: 6, maxScore: 10 },
  { human: 9, ai: 8, maxScore: 10 },
];

describe('error metrics', () => {
  it('MAE/RMSE are 0 for perfect agreement', () => {
    expect(mae(perfect)).toBe(0);
    expect(rmse(perfect)).toBe(0);
  });

  it('MAE reflects average absolute deviation', () => {
    // deviations: 0,1,1 → mean 2/3
    expect(mae(close)).toBeCloseTo(0.6667, 3);
  });

  it('returns null for empty input', () => {
    expect(mae([])).toBeNull();
    expect(rmse([])).toBeNull();
  });
});

describe('correlation', () => {
  it('pearson = 1 for perfectly linear agreement', () => {
    expect(pearson(perfect)).toBeCloseTo(1);
  });
  it('spearman = 1 for strictly monotonic (non-linear) agreement', () => {
    // Strictly increasing but non-linear → Spearman 1 even though Pearson < 1.
    const monotonic = [
      { human: 1, ai: 2, maxScore: 10 },
      { human: 2, ai: 5, maxScore: 10 },
      { human: 3, ai: 9, maxScore: 10 },
    ];
    expect(spearman(monotonic)).toBeCloseTo(1);
  });
  it('returns null with fewer than 2 points', () => {
    expect(pearson([{ human: 1, ai: 1 }])).toBeNull();
  });
});

describe('withinTolerance', () => {
  it('counts the fraction within N marks', () => {
    expect(withinTolerance(close, 1)).toBe(1); // all within 1
    expect(withinTolerance(close, 0)).toBeCloseTo(0.3333, 3); // only the exact one
  });
});

describe('passFailConfusion', () => {
  it('computes a confusion matrix and F1 around the pass threshold', () => {
    // passRatio 0.4 of 10 = 4. human/ai pass if >=4.
    const pairs = [
      { human: 8, ai: 8, maxScore: 10 }, // TP
      { human: 2, ai: 1, maxScore: 10 }, // TN
      { human: 2, ai: 5, maxScore: 10 }, // FP (ai says pass, human fail)
      { human: 7, ai: 3, maxScore: 10 }, // FN (ai says fail, human pass)
    ];
    const c = passFailConfusion(pairs, { passRatio: 0.4 });
    expect(c).toMatchObject({ tp: 1, fp: 1, tn: 1, fn: 1 });
    expect(c.accuracy).toBe(0.5);
    expect(c.f1).toBeCloseTo(0.5);
  });
});

describe('scorecard', () => {
  it('bundles all metrics', () => {
    const card = scorecard(close, { tolerance: 1, passRatio: 0.4 });
    expect(card.n).toBe(3);
    expect(card.mae).toBeGreaterThanOrEqual(0);
    expect(card.passFail).toBeDefined();
    expect(card.withinOneMark).toBe(1);
  });
});
