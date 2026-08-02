const {
  mean,
  pearson,
  itemAnalysis,
  cronbachAlpha,
  scoreDistribution,
} = require('../src/services/analyticsService');

describe('mean & pearson', () => {
  it('computes a mean', () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(mean([])).toBe(0);
  });

  it('returns +1 for perfectly correlated data', () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
  });

  it('returns -1 for perfectly anti-correlated data', () => {
    expect(pearson([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1);
  });

  it('returns 0 when one series has no variance', () => {
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0);
  });
});

describe('itemAnalysis', () => {
  // 2 students, 2 questions. Q1 is trivially easy (everyone full marks),
  // Q2 separates the strong student from the weak one.
  const rows = [
    { evaluationId: 'E1', questionNumber: 'Q1', score: 5, maxScore: 5, confidence: 0.9 },
    { evaluationId: 'E1', questionNumber: 'Q2', score: 0, maxScore: 5, confidence: 0.9 },
    { evaluationId: 'E2', questionNumber: 'Q1', score: 5, maxScore: 5, confidence: 0.9 },
    { evaluationId: 'E2', questionNumber: 'Q2', score: 5, maxScore: 5, confidence: 0.9 },
  ];

  it('computes difficulty as mean proportion correct', () => {
    const [q1, q2] = itemAnalysis(rows);
    expect(q1.questionNumber).toBe('Q1');
    expect(q1.difficulty).toBe(1); // everyone got it → easy
    expect(q2.difficulty).toBe(0.5);
  });

  it('gives an easy (no-variance) item zero discrimination and a separating item high discrimination', () => {
    const [q1, q2] = itemAnalysis(rows);
    expect(q1.discrimination).toBe(0);
    expect(q2.discrimination).toBeCloseTo(1);
  });

  it('sorts questions numerically', () => {
    const shuffled = [
      { evaluationId: 'E1', questionNumber: 'Q10', score: 1, maxScore: 2, confidence: 1 },
      { evaluationId: 'E1', questionNumber: 'Q2', score: 1, maxScore: 2, confidence: 1 },
    ];
    expect(itemAnalysis(shuffled).map((q) => q.questionNumber)).toEqual(['Q2', 'Q10']);
  });
});

describe('cronbachAlpha', () => {
  it('returns ~1 for perfectly consistent items', () => {
    const rows = [
      { evaluationId: 'E1', questionNumber: 'Q1', score: 1, maxScore: 6, confidence: 1 },
      { evaluationId: 'E1', questionNumber: 'Q2', score: 2, maxScore: 6, confidence: 1 },
      { evaluationId: 'E2', questionNumber: 'Q1', score: 3, maxScore: 6, confidence: 1 },
      { evaluationId: 'E2', questionNumber: 'Q2', score: 4, maxScore: 6, confidence: 1 },
      { evaluationId: 'E3', questionNumber: 'Q1', score: 5, maxScore: 6, confidence: 1 },
      { evaluationId: 'E3', questionNumber: 'Q2', score: 6, maxScore: 6, confidence: 1 },
    ];
    expect(cronbachAlpha(rows)).toBeCloseTo(1);
  });

  it('is undefined (null) with fewer than 2 items or 2 students', () => {
    expect(
      cronbachAlpha([{ evaluationId: 'E1', questionNumber: 'Q1', score: 1, maxScore: 5 }])
    ).toBeNull();
  });
});

describe('scoreDistribution', () => {
  it('buckets percentages into deciles with 90-100 inclusive', () => {
    const dist = scoreDistribution([5, 55, 95, 100]);
    expect(dist[0].count).toBe(1); // 0-9
    expect(dist[5].count).toBe(1); // 50-59
    expect(dist[9].count).toBe(2); // 90-100 (95 and 100)
    expect(dist[9].range).toBe('90-100');
  });
});
