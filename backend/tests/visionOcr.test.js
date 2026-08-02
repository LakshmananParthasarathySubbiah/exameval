const { provider, visionAvailable } = require('../src/utils/visionOcr');

describe('vision OCR provider selection', () => {
  const saved = {};
  const KEYS = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'GROQ_VISION_MODEL'];
  beforeEach(() => KEYS.forEach((k) => (saved[k] = process.env[k])));
  afterEach(() =>
    KEYS.forEach((k) => {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    })
  );

  it('returns null when no provider is configured', () => {
    KEYS.forEach((k) => delete process.env[k]);
    expect(provider()).toBeNull();
    expect(visionAvailable()).toBe(false);
  });

  it('prefers Gemini when GEMINI_API_KEY is set', () => {
    process.env.GEMINI_API_KEY = 'g-key';
    process.env.GROQ_API_KEY = 'groq-key';
    process.env.GROQ_VISION_MODEL = 'some-model';
    expect(provider()).toBe('gemini');
  });

  it('falls back to Groq when only Groq vision is configured', () => {
    delete process.env.GEMINI_API_KEY;
    process.env.GROQ_API_KEY = 'groq-key';
    process.env.GROQ_VISION_MODEL = 'some-model';
    expect(provider()).toBe('groq');
    expect(visionAvailable()).toBe(true);
  });
});
