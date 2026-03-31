const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function getCourses({ page = 1, limit = 20, search = '' }) {
  const skip = (page - 1) * limit;
  const where = search
    ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { code: { contains: search, mode: 'insensitive' } }] }
    : {};

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { exams: true } } },
    }),
    prisma.course.count({ where }),
  ]);

  return { courses, pagination: { page, limit, total } };
}

async function createCourse({ name, code }) {
  return prisma.course.create({ data: { name, code } });
}

async function updateCourse(id, { name, code }) {
  return prisma.course.update({ where: { id }, data: { name, code } });
}

async function deleteCourse(id) {
  return prisma.course.delete({ where: { id } });
}

module.exports = { getCourses, createCourse, updateCourse, deleteCourse };
