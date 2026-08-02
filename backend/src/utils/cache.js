/**
 * Lightweight Redis response cache (P1).
 *
 * `getOrSet` returns a cached value or computes + stores it. It is intentionally
 * fail-open: if Redis is unavailable the cache silently bypasses and the
 * compute function still runs, so a cache outage degrades latency, not
 * correctness.
 */
const { Redis } = require('ioredis');
const logger = require('./logger');

let client = null;
function getClient() {
  if (!client) {
    client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    client.on('error', () => {}); // swallow; getOrSet handles failures
  }
  return client;
}

/** Build a namespaced cache key from parts. Pure. */
function cacheKey(...parts) {
  return 'cache:' + parts.filter((p) => p != null && p !== '').join(':');
}

async function getOrSet(key, ttlSeconds, computeFn) {
  let c;
  try {
    c = getClient();
    const hit = await c.get(key);
    if (hit) return JSON.parse(hit);
  } catch (err) {
    logger.debug(`cache miss/bypass for ${key}: ${err.message}`);
  }
  const fresh = await computeFn();
  try {
    await c?.set(key, JSON.stringify(fresh), 'EX', ttlSeconds);
  } catch {
    /* fail-open: don't let a cache write break the response */
  }
  return fresh;
}

async function del(key) {
  try {
    await getClient().del(key);
  } catch {
    /* ignore */
  }
}

module.exports = { cacheKey, getOrSet, del, getClient };
