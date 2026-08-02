const prisma = require('./src/utils/prisma');

async function main() {
  console.log('Clearing database of all exam data (keeping user accounts)...');
  try {
    await prisma.$transaction([
      prisma.questionResult.deleteMany(),
      prisma.auditLog.deleteMany(),
      prisma.evaluation.deleteMany(),
      prisma.script.deleteMany(),
      prisma.student.deleteMany(),
      prisma.exam.deleteMany(),
      prisma.course.deleteMany(),
    ]);
    console.log('Database successfully cleared!');
  } catch (error) {
    console.error('Error clearing database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
