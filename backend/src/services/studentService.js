const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function getStudents({ page = 1, limit = 20, examId }) {
  const skip = (page - 1) * limit;
  const where = examId ? { examId } : {};

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        exam: { select: { title: true } },
        scripts: { select: { id: true, status: true } },
      },
    }),
    prisma.student.count({ where }),
  ]);

  return { students, pagination: { page, limit, total } };
}

async function createStudent({ name, rollNumber, email, examId }) {
  return prisma.student.create({
    data: { name, rollNumber, email, examId },
    include: { exam: { select: { title: true } } },
  });
}

async function bulkCreateStudents(students) {
  // students: [{ name, rollNumber, email, examId }]
  const results = { created: [], errors: [] };

  for (const s of students) {
    try {
      const student = await prisma.student.create({
        data: { name: s.name, rollNumber: s.rollNumber, email: s.email || null, examId: s.examId },
      });
      results.created.push(student);
    } catch (err) {
      results.errors.push({ rollNumber: s.rollNumber, error: err.message });
    }
  }

  return results;
}

async function updateStudent(id, { name, rollNumber, email }) {
  return prisma.student.update({
    where: { id },
    data: { name, rollNumber, email },
  });
}

async function deleteStudent(id) {
  return prisma.student.delete({ where: { id } });
}

module.exports = { getStudents, createStudent, bulkCreateStudents, updateStudent, deleteStudent };
