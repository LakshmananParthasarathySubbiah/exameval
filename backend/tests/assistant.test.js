const assistantController = require('../src/controllers/assistantController');
const { factsFromAnalytics, buildAssistantPrompt } = assistantController;
const groqClient = require('../src/utils/groqClient');
const assistantTools = require('../src/ai/assistantTools');

describe('factsFromAnalytics', () => {
  it('summarizes summary + item analysis into fact strings', () => {
    const facts = factsFromAnalytics({
      summary: {
        totalEvaluations: 3,
        completed: 3,
        averagePercentage: 72.5,
        pendingReview: 1,
        overrides: 0,
        reliabilityCronbachAlpha: 0.81,
        injectionFlaggedQuestions: 2,
      },
      itemAnalysis: [
        {
          questionNumber: 'Q1',
          difficulty: 0.9,
          discrimination: 0.1,
          meanScore: 4.5,
          maxScore: 5,
          n: 3,
        },
      ],
    });
    expect(facts.some((f) => f.includes('average score is 72.5%'))).toBe(true);
    expect(facts.some((f) => f.includes("Cronbach's alpha) is 0.81"))).toBe(true);
    expect(facts.some((f) => f.includes('Question Q1'))).toBe(true);
    expect(facts.some((f) => f.includes('prompt-injection'))).toBe(true);
  });

  it('handles missing fields gracefully', () => {
    expect(factsFromAnalytics({})).toEqual([]);
  });
});

describe('buildAssistantPrompt', () => {
  it('grounds the question and constrains the model', () => {
    const { systemPrompt, userMessage } = buildAssistantPrompt(
      'Which question was hardest?',
      'Q1 difficulty 0.2'
    );
    expect(systemPrompt).toMatch(/ONLY from the provided context/i);
    expect(userMessage).toContain('Q1 difficulty 0.2');
    expect(userMessage).toContain('Which question was hardest?');
  });
});

describe('agent loop (ask)', () => {
  const OLD_KEY = process.env.GROQ_API_KEY;
  let toolSpy;
  let llmSpy;

  beforeEach(() => {
    process.env.GROQ_API_KEY = 'test-key';
  });
  afterEach(() => {
    process.env.GROQ_API_KEY = OLD_KEY;
    toolSpy?.mockRestore();
    llmSpy?.mockRestore();
  });

  function mockRes() {
    return {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };
  }

  it('calls a tool, feeds results back, and returns the grounded answer', async () => {
    // Step 1: model asks to call get_overview. Step 2: model answers.
    llmSpy = vi
      .spyOn(groqClient, 'groqToolCall')
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [{ id: 'c1', function: { name: 'get_overview', arguments: '{}' } }],
      })
      .mockResolvedValueOnce({ content: 'You have 3 exams and 10 evaluations.' });

    toolSpy = vi
      .spyOn(assistantTools, 'executeTool')
      .mockResolvedValue({ exams: 3, evaluations: 10 });

    const res = mockRes();
    await assistantController.ask({ body: { question: 'give me an overview' } }, res, (e) => {
      throw e;
    });

    expect(toolSpy).toHaveBeenCalledWith('get_overview', {});
    expect(res.body.success).toBe(true);
    expect(res.body.data.answer).toContain('3 exams');
    expect(res.body.data.usedTools).toContain('get_overview');
  });

  it('400s without a question', async () => {
    const res = mockRes();
    await assistantController.ask({ body: {} }, res, () => {});
    expect(res.statusCode).toBe(400);
  });

  it('503s when GROQ_API_KEY is missing', async () => {
    delete process.env.GROQ_API_KEY;
    const res = mockRes();
    await assistantController.ask({ body: { question: 'hi' } }, res, () => {});
    expect(res.statusCode).toBe(503);
  });
});
