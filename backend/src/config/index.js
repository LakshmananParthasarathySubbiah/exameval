/**
 * Centralised, validated configuration.
 *
 * Fail fast on boot if required secrets are missing instead of discovering it
 * deep inside a request handler. Keeps all `process.env` access in one place.
 */

const REQUIRED = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
const RECOMMENDED = ['GROQ_API_KEY', 'REDIS_URL'];

function loadConfig({ throwOnMissing = true } = {}) {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length && throwOnMissing) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `Copy .env.example to .env and fill them in.`
    );
  }

  return {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '5000', 10),
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET,
      refreshSecret: process.env.JWT_REFRESH_SECRET,
      accessExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
      refreshExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
    },
    groqApiKey: process.env.GROQ_API_KEY,
    maxConcurrentGroqCalls: parseInt(process.env.MAX_CONCURRENT_GROQ_CALLS || '5', 10),
    corsOrigins: (
      process.env.CORS_ORIGINS ||
      'http://localhost:5173,http://localhost:3000,https://exameval-murex.vercel.app'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    llm: {
      primaryProvider: process.env.PRIMARY_LLM_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : 'groq'),
      gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        textModel: process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash',
        visionModel: process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash',
      },
      groq: {
        apiKey: process.env.GROQ_API_KEY,
        textModel: process.env.GROQ_TEXT_MODEL || 'llama-3.3-70b-versatile',
        visionModel: process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
      },
    },
    missing,
    recommendedMissing: RECOMMENDED.filter((k) => !process.env[k]),
  };
}

module.exports = { loadConfig, REQUIRED, RECOMMENDED };
