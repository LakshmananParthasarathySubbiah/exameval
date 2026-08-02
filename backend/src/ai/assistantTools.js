/**
 * Tools for the agentic data assistant.
 *
 * Each tool is a real function that queries THIS app's database (via the Prisma
 * singleton) and returns compact JSON. The LLM is given `toolSchemas` and picks
 * which tools to call; `executeTool` runs them. This is the owned, in-repo
 * replacement for the old external "db-agent" iframe.
 */
const prisma = require('../utils/prisma');
const analytics = require('../services/analyticsService');
const { computeExamAnalytics } = require('../controllers/analyticsController');

/** OpenAI/Groq-style function schemas advertised to the model. */
const toolSchemas = [
  {
    type: 'function',
    function: {
      name: 'get_overview',
      description:
        'High-level counts across the platform (courses, exams, students, scripts, evaluations) and the overall average percentage. Use for "give me an overview" / "how many ...".',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_exams',
      description:
        'List exams with their id, title, and course. Use to find an exam id from a name, or to answer "what exams are there".',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_exam_analytics',
      description:
        'Analytics for one exam: average, pending review, reliability (Cronbach alpha), and per-question difficulty/discrimination. Provide examId OR examTitle.',
      parameters: {
        type: 'object',
        properties: {
          examId: { type: 'string', description: 'Exam id (preferred)' },
          examTitle: { type: 'string', description: 'Exam title or partial title' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_student',
      description:
        'Look up student(s) by name or roll number, returning their exam and evaluation scores.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Name or roll number' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rank_students',
      description:
        'Top or bottom performing students for an exam by percentage. Provide examId OR examTitle.',
      parameters: {
        type: 'object',
        properties: {
          examId: { type: 'string' },
          examTitle: { type: 'string' },
          direction: { type: 'string', enum: ['top', 'bottom'], description: 'default top' },
          n: { type: 'integer', description: 'how many, default 5' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'hardest_questions',
      description:
        'The hardest questions for an exam (lowest difficulty = lowest mean proportion correct). Provide examId OR examTitle.',
      parameters: {
        type: 'object',
        properties: {
          examId: { type: 'string' },
          examTitle: { type: 'string' },
          n: { type: 'integer', description: 'how many, default 3' },
        },
      },
    },
  },
];

async function resolveExamId({ examId, examTitle }) {
  if (examId) return examId;
  if (examTitle) {
    const exam = await prisma.exam.findFirst({
      where: { title: { contains: examTitle, mode: 'insensitive' } },
      select: { id: true },
    });
    return exam?.id || null;
  }
  return null;
}

async function get_overview() {
  const [courses, exams, students, scripts, evaluations, agg] = await Promise.all([
    prisma.course.count(),
    prisma.exam.count(),
    prisma.student.count(),
    prisma.script.count(),
    prisma.evaluation.count(),
    prisma.evaluation.aggregate({ _avg: { percentage: true } }),
  ]);
  return {
    courses,
    exams,
    students,
    scripts,
    evaluations,
    averagePercentage:
      agg._avg.percentage != null ? Math.round(agg._avg.percentage * 100) / 100 : null,
  };
}

async function list_exams() {
  const exams = await prisma.exam.findMany({
    select: { id: true, title: true, course: { select: { code: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return exams.map((e) => ({ id: e.id, title: e.title, course: e.course?.code || null }));
}

async function get_exam_analytics(args) {
  const examId = await resolveExamId(args);
  if (!examId) return { error: 'Exam not found. Use list_exams to find a valid exam.' };
  const data = await computeExamAnalytics(examId);
  return { examId, summary: data.summary, itemAnalysis: data.itemAnalysis };
}

async function find_student({ query }) {
  if (!query) return { error: 'query is required' };
  const students = await prisma.student.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { rollNumber: { contains: query, mode: 'insensitive' } },
      ],
    },
    take: 5,
    include: {
      exam: { select: { title: true } },
      scripts: {
        include: {
          evaluations: {
            select: { percentage: true, totalScore: true, maxScore: true, status: true },
          },
        },
      },
    },
  });
  return students.map((s) => ({
    name: s.name,
    rollNumber: s.rollNumber,
    exam: s.exam?.title || null,
    evaluations: s.scripts.flatMap((sc) =>
      sc.evaluations.map((ev) => ({
        percentage: ev.percentage,
        score: ev.totalScore,
        maxScore: ev.maxScore,
        status: ev.status,
      }))
    ),
  }));
}

async function rank_students(args) {
  const examId = await resolveExamId(args);
  if (!examId) return { error: 'Exam not found. Use list_exams to find a valid exam.' };
  const n = Math.min(Math.max(parseInt(args.n, 10) || 5, 1), 20);
  const direction = args.direction === 'bottom' ? 'bottom' : 'top';

  const evaluations = await prisma.evaluation.findMany({
    where: { script: { examId }, percentage: { not: null } },
    select: {
      percentage: true,
      script: { select: { student: { select: { name: true, rollNumber: true } } } },
    },
  });
  const ranked = evaluations
    .map((e) => ({
      name: e.script?.student?.name || 'Unknown',
      rollNumber: e.script?.student?.rollNumber || null,
      percentage: e.percentage,
    }))
    .sort((a, b) =>
      direction === 'top' ? b.percentage - a.percentage : a.percentage - b.percentage
    )
    .slice(0, n);
  return { direction, students: ranked };
}

async function hardest_questions(args) {
  const examId = await resolveExamId(args);
  if (!examId) return { error: 'Exam not found. Use list_exams to find a valid exam.' };
  const n = Math.min(Math.max(parseInt(args.n, 10) || 3, 1), 20);
  const data = await computeExamAnalytics(examId);
  const hardest = [...data.itemAnalysis].sort((a, b) => a.difficulty - b.difficulty).slice(0, n);
  return { hardest };
}

const handlers = {
  get_overview,
  list_exams,
  get_exam_analytics,
  find_student,
  rank_students,
  hardest_questions,
};

/** Execute a tool by name. Returns a JSON-serializable result or { error }. */
async function executeTool(name, args = {}) {
  const fn = handlers[name];
  if (!fn) return { error: `Unknown tool: ${name}` };
  return fn(args || {});
}

module.exports = { toolSchemas, executeTool, resolveExamId, handlers };
