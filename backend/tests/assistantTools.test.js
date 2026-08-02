const { toolSchemas, executeTool, handlers } = require('../src/ai/assistantTools');

describe('toolSchemas', () => {
  it('declares well-formed function tools', () => {
    expect(Array.isArray(toolSchemas)).toBe(true);
    expect(toolSchemas.length).toBeGreaterThanOrEqual(6);
    for (const t of toolSchemas) {
      expect(t.type).toBe('function');
      expect(typeof t.function.name).toBe('string');
      expect(t.function.parameters).toBeDefined();
      // every advertised tool has an implementation
      expect(typeof handlers[t.function.name]).toBe('function');
    }
  });

  it('advertises the core data tools', () => {
    const names = toolSchemas.map((t) => t.function.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'get_overview',
        'list_exams',
        'get_exam_analytics',
        'find_student',
        'rank_students',
        'hardest_questions',
      ])
    );
  });
});

describe('executeTool', () => {
  it('returns an error object for an unknown tool', async () => {
    const res = await executeTool('does_not_exist', {});
    expect(res).toEqual({ error: expect.stringContaining('Unknown tool') });
  });
});
