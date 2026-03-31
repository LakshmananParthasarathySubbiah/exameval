const { PrismaClient } = require('@prisma/client');
const { extractText } = require('../utils/extractText');
const { uploadToSupabase } = require('../utils/supabase');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

async function getExams({ page = 1, limit = 20, courseId }) {
  const skip = (page - 1) * limit;
  const where = courseId ? { courseId } : {};

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

async function createExam({ title, date, courseId, rubricFile }) {
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
    data: { title, date: new Date(date), courseId, rubricFilePath, rubricText },
    include: { course: { select: { name: true, code: true } } },
  });
}

async function updateExam(id, { title, date, courseId, rubricFile }) {
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

async function deleteExam(id) {
  return prisma.exam.delete({ where: { id } });
}

module.exports = { getExams, getExamById, createExam, updateExam, deleteExam };