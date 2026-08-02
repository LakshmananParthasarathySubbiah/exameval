const { extractText } = require('../utils/extractText');
const { uploadToSupabase } = require('../utils/supabase');
const logger = require('../utils/logger');
const prisma = require('../utils/prisma');

/**
 * Ownership rule: admins manage every exam; staff only the exams they created.
 * Pure + testable.
 */
function canManageExam(exam, user) {
  if (!exam || !user) return false;
  return user.role === 'ADMIN' || exam.createdById === user.id;
}

function assertCanManage(exam, user) {
  if (!canManageExam(exam, user)) {
    const err = new Error('You can only manage exams you created');
    err.status = 403;
    throw err;
  }
}

async function getExams({ page = 1, limit = 20, courseId, user }) {
  const skip = (page - 1) * limit;
  const where = {};
  if (courseId) where.courseId = courseId;
  // Staff see only their own exams; admins see all.
  if (user && user.role !== 'ADMIN') where.createdById = user.id;

  const [exams, total] = await Promise.all([
    prisma.exam.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        course: { select: { name: true, code: true } },
        _count: { select: { students: true, scripts: true } },
      },
    }),
    prisma.exam.count({ where }),
  ]);

  return { exams, pagination: { page, limit, total } };
}

async function getExamById(id) {
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      course: { select: { name: true, code: true } },
      _count: { select: { students: true, scripts: true } },
    },
  });
  if (!exam) {
    const err = new Error('Exam not found');
    err.status = 404;
    throw err;
  }
  return exam;
}

async function createExam({ title, date, courseId, rubricFile }, user) {
  let rubricFilePath = null;
  let rubricText = null;

  if (rubricFile) {
    // Extract text BEFORE uploading
    const { text } = await extractText(rubricFile.path);
    rubricText = text;
    // Upload to Supabase
    const { url } = await uploadToSupabase(rubricFile.path, 'rubrics');
    rubricFilePath = url;
    logger.info(`Rubric uploaded to Supabase for exam: ${title}`);
  }

  return prisma.exam.create({
    data: {
      title,
      date: new Date(date),
      courseId,
      rubricFilePath,
      rubricText,
      createdById: user?.id || null,
    },
    include: { course: { select: { name: true, code: true } } },
  });
}

async function updateExam(id, { title, date, courseId, rubricFile }, user) {
  const existing = await prisma.exam.findUnique({ where: { id }, select: { createdById: true } });
  if (!existing) {
    const err = new Error('Exam not found');
    err.status = 404;
    throw err;
  }
  assertCanManage(existing, user);

  const updateData = {};
  if (title) updateData.title = title;
  if (date) updateData.date = new Date(date);
  if (courseId) updateData.courseId = courseId;

  if (rubricFile) {
    const { text } = await extractText(rubricFile.path);
    updateData.rubricText = text;
    const { url } = await uploadToSupabase(rubricFile.path, 'rubrics');
    updateData.rubricFilePath = url;
    updateData.rubricParsed = null;
  }

  return prisma.exam.update({
    where: { id },
    data: updateData,
    include: { course: { select: { name: true, code: true } } },
  });
}

async function deleteExam(id, user) {
  const existing = await prisma.exam.findUnique({ where: { id }, select: { createdById: true } });
  if (!existing) {
    const err = new Error('Exam not found');
    err.status = 404;
    throw err;
  }
  assertCanManage(existing, user);
  return prisma.exam.delete({ where: { id } });
}

module.exports = {
  getExams,
  getExamById,
  createExam,
  updateExam,
  deleteExam,
  canManageExam,
};
