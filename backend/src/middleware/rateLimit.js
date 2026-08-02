/**
 * Rate limiters.
 *
 * Two threats this addresses:
 *  1. Brute force on auth endpoints  -> `authLimiter` (strict).
 *  2. LLM-cost abuse on evaluation   -> `evaluationLimiter` — every run spends
 *     real Groq tokens, so this is a financial control, not just a UX one.
 *
 * NOTE: the default store is in-memory and therefore per-instance. For a
 * multi-instance deployment, swap in `rate-limit-redis` backed by the existing
 * Redis connection so limits are shared across replicas.
 */
const rateLimit = require('express-rate-limit');

const json = (error) => ({ success: false, error });

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: json('Too many authentication attempts. Please try again later.'),
});

const evaluationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: json('Evaluation rate limit exceeded. Please slow down.'),
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: json('Too many requests. Please slow down.'),
});

module.exports = { authLimiter, evaluationLimiter, apiLimiter };
