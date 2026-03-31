const { PrismaClient } = require('@prisma/client');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');
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
  // Upload to Cloudinary first
  const { url } = await uploadToCloudinary(filePath, 'exameval/scripts');
  return prisma.script.create({
    data: { studentId, examId, filePath: url, status: 'UPLOADED' },
    include: { student: { select: { name: true, rollNumber: true } } },
  });
}

async function bulkCreateScripts(files) {
  const results = [];
  for (const f of files) {
    const { url } = await uploadToCloudinary(f.filePath, 'exameval/scripts');
    results.push({ studentId: f.studentId, examId: f.examId, filePath: url });
  }
  return prisma.script.createMany({ data: results });
}

async function deleteScript(id) {
  const script = await prisma.script.findUnique({ where: { id } });
  if (!script) {
    const err = new Error('Script not found');
    err.status = 404;
    throw err;
  }

  // Delete from Cloudinary if it's a Cloudinary URL
  if (script.filePath?.includes('cloudinary.com')) {
    const parts = script.filePath.split('/');
    const filename = parts[parts.length - 1].split('.')[0];
    const folder = parts.slice(-3, -1).join('/');
    await deleteFromCloudinary(`${folder}/${filename}`);
  }

  return prisma.script.delete({ where: { id } });
}

module.exports = { getScripts, getScriptById, createScript, bulkCreateScripts, deleteScript };