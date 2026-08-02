const prisma = require('../utils/prisma');
const analytics = require('../services/analyticsService');
const groqClient = require('../utils/groqClient');
const assistantTools = require('../ai/assistantTools');
const logger = require('../utils/logger');

const SYSTEM_PROMPT =
  "You are ExamEval's data assistant. Answer questions about the user's own exam-evaluation data. " +
  'ALWAYS use the provided tools to look up real data before answering — never invent numbers, names, or scores. ' +
  'If a tool returns an error or empty result, say so briefly. ' +
  'Be concise, cite specific figures and question/exam names, and format lists clearly.';

const MAX_STEPS = 4;
const MAX_HISTORY = 6;

/** Keep only well-formed prior turns and bound their size. */
function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
}

/**
 * Turn computed analytics into short natural-language "facts" (fallback path).
 * Pure + testable.
 */
function factsFromAnalytics({ summary, itemAnalysis }) {
  const facts = [];
  if (summary) {
    facts.push(
      `There are ${summary.totalEvaluations} evaluations; ${summary.completed} completed.`
    );
    facts.push(`The average score is ${summary.averagePercentage}%.`);
    facts.push(`${summary.pendingReview} evaluations are pending human review (low confidence).`);
    facts.push(`Staff overrode the AI score ${summary.overrides} times.`);
    if (summary.reliabilityCronbachAlpha != null)
      facts.push(`Exam reliability (Cronbach's alpha) is ${summary.reliabilityCronbachAlpha}.`);
    if (summary.injectionFlaggedQuestions)
      facts.push(
        `${summary.injectionFlaggedQuestions} answers were flagged as possible prompt-injection.`
      );
  }
  for (const q of itemAnalysis || []) {
    facts.push(
      `Question ${q.questionNumber}: difficulty ${q.difficulty} (0=hard,1=easy), discrimination ${q.discrimination}, mean ${q.meanScore}/${q.maxScore} across ${q.n} students.`
    );
  }
  return facts;
}

/** Build a grounded single-shot prompt (fallback path). Pure + testable. */
function buildAssistantPrompt(question, groundingContext) {
  const systemPrompt =
    'You are an analytics assistant for an exam-evaluation platform. ' +
    "Answer ONLY from the provided context about the user's own grading data. " +
    'If the context does not contain the answer, say you do not have that data. ' +
    'Be concise and specific; cite question numbers and figures when relevant.';
  const userMessage = `Context:\n${groundingContext || '(no analytics available)'}\n\nQuestion: ${question}`;
  return { systemPrompt, userMessage };
}

async function getAllFacts() {
  try {
    const [courseCount, examCount, studentCount, evalCount, avgEval] = await Promise.all([
      prisma.course.count(),
      prisma.exam.count(),
      prisma.student.count(),
      prisma.evaluation.count(),
      prisma.evaluation.aggregate({
        _avg: { percentage: true },
      }),
    ]);

    const exams = await prisma.exam.findMany({
      include: {
        course: { select: { name: true, code: true } },
        scripts: {
          include: {
            evaluations: {
              select: { percentage: true }
            }
          }
        },
        _count: { select: { students: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    const courses = await prisma.course.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    const topEvaluations = await prisma.evaluation.findMany({
      where: { percentage: { not: null } },
      orderBy: { percentage: 'desc' },
      take: 10,
      select: {
        percentage: true,
        script: {
          select: {
            student: { select: { name: true, rollNumber: true } },
            exam: { select: { title: true } },
          },
        },
      },
    });

    const facts = [
      `Overall Platform Summary:`,
      `- Total Courses: ${courseCount}`,
      `- Total Exams: ${examCount}`,
      `- Total Registered Students: ${studentCount}`,
      `- Total Evaluations Run: ${evalCount}`,
      `- Overall Evaluation Average Score: ${avgEval._avg.percentage ? avgEval._avg.percentage.toFixed(2) : 0}%`,
      `Active Courses:`,
    ];

    for (const c of courses) {
      facts.push(`- Course "${c.name}" (Code: ${c.code})`);
    }

    facts.push(`Active Exams on Platform:`);
    for (const ex of exams) {
      const percentages = ex.scripts
        .flatMap((s) => s.evaluations)
        .filter((ev) => ev.percentage != null)
        .map((ev) => ev.percentage);
      const avg = percentages.length
        ? (percentages.reduce((a, b) => a + b, 0) / percentages.length).toFixed(2)
        : 'N/A';
      facts.push(`- Exam "${ex.title}" (ID: ${ex.id}) for Course "${ex.course.name}" (${ex.course.code}) - Avg Score: ${avg}%, Students: ${ex._count.students}`);
    }

    facts.push(`Top Performing Students Overall:`);
    for (const ev of topEvaluations) {
      if (ev.script?.student) {
        facts.push(`- ${ev.script.student.name} (Roll: ${ev.script.student.rollNumber || 'N/A'}) - ${ev.percentage}% in Exam "${ev.script.exam?.title || 'Unknown'}"`);
      }
    }

    return facts;
  } catch (err) {
    logger.error('Failed to get global facts', { error: err.message });
    return ['No platform statistics available.'];
  }
}

async function getExamFacts(examId) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { title: true, course: { select: { name: true, code: true } } }
  });

  const evaluations = await prisma.evaluation.findMany({
    where: { script: { examId } },
    select: {
      id: true,
      percentage: true,
      status: true,
      overrideScore: true,
      script: {
        select: {
          student: {
            select: {
              name: true,
              rollNumber: true,
            },
          },
        },
      },
      questionResults: {
        select: {
          questionNumber: true,
          score: true,
          maxScore: true,
          confidence: true,
          injectionFlagged: true,
        },
      },
    },
  });

  const rows = [];
  for (const e of evaluations) {
    for (const q of e.questionResults) {
      rows.push({
        evaluationId: e.id,
        questionNumber: q.questionNumber,
        score: q.score,
        maxScore: q.maxScore,
      });
    }
  }

  const percentages = evaluations.filter((e) => e.percentage != null).map((e) => e.percentage);
  const summary = {
    totalEvaluations: evaluations.length,
    completed: evaluations.filter((e) => ['COMPLETED', 'PENDING_REVIEW'].includes(e.status)).length,
    pendingReview: evaluations.filter((e) => e.status === 'PENDING_REVIEW').length,
    overrides: evaluations.filter((e) => e.overrideScore != null).length,
    averagePercentage: percentages.length ? analytics.round(analytics.mean(percentages), 2) : 0,
    injectionFlaggedQuestions: evaluations.reduce(
      (a, e) => a + e.questionResults.filter((q) => q.injectionFlagged).length,
      0
    ),
    reliabilityCronbachAlpha: analytics.cronbachAlpha(rows),
  };

  const analyticsFacts = factsFromAnalytics({ summary, itemAnalysis: analytics.itemAnalysis(rows) });

  const studentScores = evaluations
    .filter((e) => e.percentage != null && e.script?.student)
    .map((e) => ({
      name: e.script.student.name,
      rollNumber: e.script.student.rollNumber || 'N/A',
      percentage: e.percentage,
    }));

  const topStudents = [...studentScores]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5);

  const bottomStudents = [...studentScores]
    .sort((a, b) => a.percentage - b.percentage)
    .slice(0, 5);

  const headerFact = exam
    ? `Exam Overview: "${exam.title}" (Course: ${exam.course.name} [${exam.course.code}], ID: ${examId})`
    : `Exam Overview (ID: ${examId})`;

  const studentFacts = [
    `Top performing students for this exam:`,
    ...topStudents.map((s, idx) => `  - ${s.name} (Roll: ${s.rollNumber}) - ${s.percentage}%`),
    `Bottom performing students for this exam:`,
    ...bottomStudents.map((s, idx) => `  - ${s.name} (Roll: ${s.rollNumber}) - ${s.percentage}%`),
  ];

  return [headerFact, ...analyticsFacts, ...studentFacts];
}

/**
 * POST /api/assistant/ask  { question, history?, examId? }
 * Agentic loop: the model calls data tools (assistantTools) against the real DB
 * until it can answer, grounded in tool results.
 */
async function ask(req, res, next) {
  try {
    const { question, history, examId } = req.body || {};
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ success: false, error: 'A "question" string is required' });
    }
    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'Assistant unavailable: GROQ_API_KEY is not configured on the server.',
      });
    }

    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    if (examId) {
      messages.push({
        role: 'system',
        content: `The user is currently focused on exam id "${examId}". Prefer it when an exam is implied.`,
      });
    }
    messages.push(...sanitizeHistory(history));
    messages.push({ role: 'user', content: question });

    const usedTools = [];
    let answer = '';

    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        const msg = await groqClient.groqToolCall({
          messages,
          tools: assistantTools.toolSchemas,
          label: 'assistant',
        });
        const toolCalls = msg.tool_calls || [];

        if (toolCalls.length) {
          messages.push({ role: 'assistant', content: msg.content || '', tool_calls: toolCalls });
          for (const call of toolCalls) {
            let args = {};
            try {
              args = JSON.parse(call.function?.arguments || '{}');
            } catch {
              args = {};
            }
            let result;
            try {
              result = await assistantTools.executeTool(call.function?.name, args);
            } catch (e) {
              result = { error: e.message };
            }
            usedTools.push(call.function?.name);
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify(result).slice(0, 6000),
            });
          }
          continue;
        }

        answer = msg.content || '';
        break;
      }
    } catch (agentError) {
      logger.warn(`Assistant agent loop failed: ${agentError.message}. Falling back to grounded single-shot.`);
    }

    // Fallback: grounded single-shot if the agent loop produced nothing or failed.
    if (!answer) {
      const facts = examId ? await getExamFacts(examId) : await getAllFacts();
      const { systemPrompt, userMessage } = buildAssistantPrompt(question, facts.join('\n'));
      answer = await groqClient.groqTextCall({
        systemPrompt,
        userMessage,
        label: 'assistant-fallback',
      });
    }

    res.json({
      success: true,
      data: { answer: answer || 'I could not find an answer.', usedTools: [...new Set(usedTools)] },
    });
  } catch (err) {
    logger.error('Assistant error', { error: err.message });
    next(err);
  }
}

module.exports = { ask, factsFromAnalytics, buildAssistantPrompt };
