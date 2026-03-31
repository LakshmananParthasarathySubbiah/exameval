const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminHash = await bcrypt.hash('Admin@123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@exameval.com' },
    update: {},
    create: {
      email: 'admin@exameval.com',
      passwordHash: adminHash,
      role: 'ADMIN',
    },
  });

  // Create staff user
  const staffHash = await bcrypt.hash('Staff@123', 10);
  const staff = await prisma.user.upsert({
    where: { email: 'staff@exameval.com' },
    update: {},
    create: {
      email: 'staff@exameval.com',
      passwordHash: staffHash,
      role: 'STAFF',
    },
  });

  // Create courses
  const cs101 = await prisma.course.upsert({
    where: { code: 'CS101' },
    update: {},
    create: { name: 'Introduction to Computer Science', code: 'CS101' },
  });

  const dbms = await prisma.course.upsert({
    where: { code: 'BCSE302L' },
    update: {},
    create: { name: 'Database Management Systems', code: 'BCSE302L' },
  });

  const cn = await prisma.course.upsert({
    where: { code: 'BCSE308L' },
    update: {},
    create: { name: 'Computer Networks', code: 'BCSE308L' },
  });

  // Create an exam
  const exam = await prisma.exam.create({
    data: {
      title: 'DBMS Mid-Term Examination',
      date: new Date('2025-04-15'),
      courseId: dbms.id,
      rubricText: 'Q1: Explain normalization (10 marks). Key points: 1NF, 2NF, 3NF, BCNF definitions and examples.\nQ2: Write SQL JOIN query (10 marks). Key points: INNER JOIN syntax, correct WHERE clause, proper aliasing.',
    },
  });

  // Create students
  const students = await Promise.all([
    prisma.student.create({
      data: { name: 'Arjun Kumar', rollNumber: '21BCE0001', email: 'arjun@vit.ac.in', examId: exam.id },
    }),
    prisma.student.create({
      data: { name: 'Priya Sharma', rollNumber: '21BCE0002', email: 'priya@vit.ac.in', examId: exam.id },
    }),
    prisma.student.create({
      data: { name: 'Rohit Verma', rollNumber: '21BCE0003', email: 'rohit@vit.ac.in', examId: exam.id },
    }),
  ]);

  console.log('Seed complete!');
  console.log('Admin: admin@exameval.com / Admin@123');
  console.log('Staff: staff@exameval.com / Staff@123');
  console.log(`Created ${students.length} students for exam: ${exam.title}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
