const {
  embedText,
  cosineSimilarity,
  buildIndex,
  retrieveTopK,
  buildGroundingContext,
} = require('../src/ai/rag');

describe('embedText', () => {
  it('produces an L2-normalized vector for non-empty text', () => {
    const v = embedText('normalization in database systems');
    const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('is deterministic', () => {
    expect(embedText('hello world')).toEqual(embedText('hello world'));
  });

  it('returns a zero vector for empty input', () => {
    expect(embedText('').every((x) => x === 0)).toBe(true);
  });
});

describe('cosineSimilarity', () => {
  it('is 1 for identical text and lower for unrelated text', () => {
    const a = embedText('binary search tree traversal');
    const same = embedText('binary search tree traversal');
    const diff = embedText('photosynthesis in plants');
    expect(cosineSimilarity(a, same)).toBeCloseTo(1, 5);
    expect(cosineSimilarity(a, diff)).toBeLessThan(0.5);
  });

  it('handles degenerate input', () => {
    expect(cosineSimilarity(null, [1, 2])).toBe(0);
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });
});

describe('retrieveTopK', () => {
  const index = buildIndex([
    'Normalization: 1NF, 2NF, 3NF and BCNF definitions with examples.',
    'SQL JOIN: INNER JOIN syntax, ON clause, and table aliasing.',
    'Operating systems: process scheduling and context switching.',
  ]);

  it('ranks the most relevant chunk first', () => {
    // Lexical TF-hash retriever: query shares vocabulary with the target chunk.
    const top = retrieveTopK('normalization definitions and examples', index, 1);
    expect(top[0].text).toContain('Normalization');
    expect(top[0].score).toBeGreaterThan(0);
  });

  it('respects k', () => {
    expect(retrieveTopK('sql join query', index, 2)).toHaveLength(2);
  });
});

describe('buildGroundingContext', () => {
  const index = buildIndex(['1NF 2NF 3NF normalization rules', 'TCP three-way handshake']);

  it('returns a grounding block when relevant material exists', () => {
    const ctx = buildGroundingContext('normalization', index, { k: 1, minScore: 0 });
    expect(ctx).toContain('Relevant reference material');
    expect(ctx).toContain('normalization');
  });

  it('returns empty string when nothing clears the threshold', () => {
    const ctx = buildGroundingContext('quantum entanglement', index, { k: 1, minScore: 0.9 });
    expect(ctx).toBe('');
  });
});
