const { loadConfig, REQUIRED } = require('../src/config');

describe('loadConfig', () => {
  const saved = {};
  beforeEach(() => {
    REQUIRED.forEach((k) => {
      saved[k] = process.env[k];
    });
  });
  afterEach(() => {
    REQUIRED.forEach((k) => {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    });
  });

  it('throws when a required env var is missing', () => {
    REQUIRED.forEach((k) => delete process.env[k]);
    expect(() => loadConfig()).toThrow(/Missing required environment variables/);
  });

  it('reports missing vars without throwing when throwOnMissing is false', () => {
    REQUIRED.forEach((k) => delete process.env[k]);
    const cfg = loadConfig({ throwOnMissing: false });
    expect(cfg.missing).toEqual(expect.arrayContaining(REQUIRED));
  });

  it('returns parsed defaults when required vars are present', () => {
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
    process.env.JWT_ACCESS_SECRET = 'a';
    process.env.JWT_REFRESH_SECRET = 'b';
    const cfg = loadConfig();
    expect(cfg.port).toBe(Number(cfg.port));
    expect(Array.isArray(cfg.corsOrigins)).toBe(true);
    expect(cfg.corsOrigins.length).toBeGreaterThan(0);
    expect(cfg.jwt.accessExpiry).toBeTruthy();
  });
});
