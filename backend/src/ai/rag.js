/**
 * Retrieval-Augmented Generation (RAG) primitives for grounding grading.
 *
 * Goal: given a question, retrieve the most relevant rubric criteria / reference
 * snippets and inject ONLY those into the grading prompt — reducing hallucination
 * and token cost vs dumping the whole rubric.
 *
 * The embedder here is a dependency-free, deterministic TF-hashing embedder so
 * retrieval works and is unit-testable offline. It implements the same interface
 * a hosted model would (`embedText`), so you can swap in OpenAI
 * `text-embedding-3-small` or a local sentence-transformer by replacing
 * `embedText` — `cosineSimilarity`, `buildIndex`, and `retrieveTopK` stay the same.
 */

const DIM = 256;

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

// Deterministic string hash → bucket index (FNV-1a).
function hashToken(token) {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % DIM;
}

/** Embed text into an L2-normalized TF-hash vector. */
function embedText(text, dim = DIM) {
  const vec = new Array(dim).fill(0);
  for (const tok of tokenize(text)) {
    vec[hashToken(tok)] += 1;
  }
  const norm = Math.sqrt(vec.reduce((a, b) => a + b * b, 0));
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

/** Cosine similarity of two equal-length vectors. */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const den = Math.sqrt(na) * Math.sqrt(nb);
  return den === 0 ? 0 : dot / den;
}

/** Pre-embed a set of reference chunks into an index. */
function buildIndex(chunks) {
  return chunks
    .filter((c) => c && (typeof c === 'string' ? c.trim() : c.text))
    .map((c) => {
      const text = typeof c === 'string' ? c : c.text;
      return { text, meta: typeof c === 'string' ? {} : c.meta || {}, vector: embedText(text) };
    });
}

/** Return the top-k most similar chunks to the query, with scores. */
function retrieveTopK(query, index, k = 3) {
  const q = embedText(query);
  return index
    .map((entry) => ({
      text: entry.text,
      meta: entry.meta,
      score: cosineSimilarity(q, entry.vector),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/**
 * Build a compact grounding block for a question from reference chunks.
 * Returns '' when nothing relevant is found (caller can skip grounding).
 */
function buildGroundingContext(question, index, { k = 3, minScore = 0.05 } = {}) {
  const hits = retrieveTopK(question, index, k).filter((h) => h.score >= minScore);
  if (!hits.length) return '';
  return (
    'Relevant reference material (retrieved):\n' +
    hits.map((h, i) => `  [${i + 1}] ${h.text}`).join('\n')
  );
}

module.exports = {
  embedText,
  cosineSimilarity,
  buildIndex,
  retrieveTopK,
  buildGroundingContext,
  DIM,
};
