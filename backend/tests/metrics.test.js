const { register, llmTokensTotal, evaluationsTotal } = require('../src/utils/metrics');

describe('metrics registry', () => {
  it('exposes default + custom metrics in Prometheus format', async () => {
    llmTokensTotal.inc({ label: 'test' }, 5);
    evaluationsTotal.inc({ status: 'completed' });
    const out = await register.metrics();
    expect(out).toContain('http_request_duration_seconds');
    expect(out).toContain('llm_tokens_total');
    expect(out).toContain('evaluations_total');
    expect(out).toContain('nodejs_'); // default process metrics present
  });
});
