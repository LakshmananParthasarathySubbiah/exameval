const { sigmoid, train, rocAuc, featuresFromEvaluation } = require('../src/ml/calibration');

describe('sigmoid', () => {
  it('maps 0→0.5 and is bounded', () => {
    expect(sigmoid(0)).toBeCloseTo(0.5);
    expect(sigmoid(50)).toBeGreaterThan(0.99);
    expect(sigmoid(-50)).toBeLessThan(0.01);
  });
});

describe('logistic regression training', () => {
  it('learns a separable boundary (y = 1 when x0 + x1 > 0)', () => {
    const X = [];
    const y = [];
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff - 0.5;
    };
    for (let i = 0; i < 200; i++) {
      const a = rand() * 4;
      const b = rand() * 4;
      X.push([a, b]);
      y.push(a + b > 0 ? 1 : 0);
    }
    const model = train(X, y, { lr: 0.5, epochs: 500 });

    const correct = X.filter((x, i) => model.predict(x) === y[i]).length;
    expect(correct / X.length).toBeGreaterThan(0.9); // >90% accuracy

    const scores = X.map((x) => model.predictProba(x));
    expect(rocAuc(y, scores)).toBeGreaterThan(0.9); // strong ranking
  });
});

describe('rocAuc', () => {
  it('is 1 for perfectly separable scores', () => {
    expect(rocAuc([0, 0, 1, 1], [0.1, 0.2, 0.8, 0.9])).toBeCloseTo(1);
  });
  it('is ~0.5 for random/degenerate', () => {
    expect(rocAuc([1, 1, 1], [0.5, 0.6, 0.7])).toBe(0.5); // no negatives
  });
});

describe('featuresFromEvaluation', () => {
  it('extracts a 5-dim feature vector', () => {
    const f = featuresFromEvaluation({
      ocrUsed: true,
      questionResults: [
        { confidence: 0.9, studentAnswer: 'a'.repeat(500), injectionFlagged: false },
        { confidence: 0.4, studentAnswer: 'b'.repeat(500), injectionFlagged: true },
      ],
    });
    expect(f).toHaveLength(5);
    expect(f[0]).toBeCloseTo(0.65); // mean confidence
    expect(f[1]).toBeCloseTo(0.4); // min confidence
    expect(f[3]).toBe(1); // ocrUsed
    expect(f[4]).toBe(1); // injectionFlagged
  });
});
