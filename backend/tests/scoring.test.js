const { clamp, aggregate, CONFIDENCE_THRESHOLD } = require('../src/ai/scoring');

describe('clamp', () => {
  it('bounds a value within [lo, hi]', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it('coerces non-numbers to 0 before clamping', () => {
    expect(clamp('abc', 0, 10)).toBe(0);
    expect(clamp(undefined, 0, 10)).toBe(0);
    expect(clamp(NaN, 0, 10)).toBe(0);
    expect(clamp('7', 0, 10)).toBe(7);
  });
});

describe('aggregate', () => {
  const results = [
    { questionNumber: 'Q1', score: 4, maxScore: 5, confidence: 0.9 },
    { questionNumber: 'Q2', score: 3, maxScore: 5, confidence: 0.8 },
  ];

  it('sums scores and computes a rounded percentage', () => {
    const out = aggregate(results);
    expect(out.totalScore).toBe(7);
    expect(out.maxScore).toBe(10);
    expect(out.percentage).toBe(70);
    expect(out.status).toBe('COMPLETED');
    expect(out.lowConfidence).toEqual([]);
  });

  it('flags PENDING_REVIEW when any question is below the confidence threshold', () => {
    const out = aggregate([
      ...results,
      { questionNumber: 'Q3', score: 1, maxScore: 5, confidence: 0.4 },
    ]);
    expect(out.status).toBe('PENDING_REVIEW');
    expect(out.lowConfidence).toContain('Q3');
  });

  it('avoids divide-by-zero when maxScore is 0', () => {
    const out = aggregate([{ questionNumber: 'Q1', score: 0, maxScore: 0, confidence: 1 }]);
    expect(out.percentage).toBe(0);
  });

  it('exposes a sane default threshold', () => {
    expect(CONFIDENCE_THRESHOLD).toBeGreaterThan(0);
    expect(CONFIDENCE_THRESHOLD).toBeLessThanOrEqual(1);
  });
});
