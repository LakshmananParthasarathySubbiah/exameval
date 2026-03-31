const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function getAuditLogs({ evaluationId, page = 1, limit = 50 }) {
  const skip = (page - 1) * limit;
  const where = evaluationId ? { evaluationId } : {};

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true, role: true } },
        evaluation: {
          select: {
            id: true,
            script: { select: { student: { select: { name: true, rollNumber: true } } } },
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, pagination: { page, limit, total } };
}

module.exports = { getAuditLogs };
