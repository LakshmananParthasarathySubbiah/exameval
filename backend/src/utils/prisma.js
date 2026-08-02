/**
 * Single shared PrismaClient instance.
 *
 * Previously every service/middleware/worker called `new PrismaClient()`,
 * which opens its own connection pool. Under load that exhausts Postgres
 * connections. Importing this module everywhere guarantees exactly one client
 * per process (and survives hot-reload in dev via a global cache).
 */
const { PrismaClient } = require('@prisma/client');

const globalForPrisma = global;

const prisma =
  globalForPrisma.__examEvalPrisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__examEvalPrisma = prisma;
}

module.exports = prisma;
