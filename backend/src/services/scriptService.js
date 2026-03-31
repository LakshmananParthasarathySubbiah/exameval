const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

async function getScripts({ page = 1, limit = 20, examId, studentId }) {
  const skip = (page - 1) * limit;
  const where = {};
  if (examId) where.examId = examId;
  if (studentId) where.studentId = studentId;

  const [scripts, total] = await Promise.all([
    prisma.script.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { name: true, rollNumber: true } },
        exam: { select: { title: true } },
        evaluations: { select: { id: true, status: true, percentage: true } },
      },
    }),
    prisma.script.count({ where }),
  ]);

  return { scripts, pagination: { page, limit, total } };
}

async function getScriptById(id) {
  const script = await prisma.script.findUnique({
    where: { id },
    include: {
      student: { select: { name: true, rollNumber: true, email: true } },
      exam: { select: { title: true } },
      evaluations: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!script) {
    const err = new Error('Script not found');
    err.status = 404;
    throw err;
  }
  return script;
}

async function createScript({ studentId, examId, filePath }) {
  return prisma.script.create({
    data: { studentId, examId, filePath, status: 'UPLOADED' },
    include: { student: { select: { name: true, rollNumber: true } } },
  });
}

async function bulkCreateScripts(files) {
  // files: [{ studentId, examId, filePath }]
  return prisma.script.createMany({ data: files });
}

async function deleteScript(id) {
  const script = await prisma.script.findUnique({ where: { id } });
  if (!script) {
    const err = new Error('Script not found');
    err.status = 404;
    throw err;
  }

  // Delete physical file
  try {
    fs.unlinkSync(script.filePath);
  } catch (err) {
    logger.warn(`Could not delete file ${script.filePath}: ${err.message}`);
  }

  return prisma.script.delete({ where: { id } });
}

module.exports = { getScripts, getScriptById, createScript, bulkCreateScripts, deleteScript };
