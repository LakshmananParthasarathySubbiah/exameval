/* eslint-disable no-console */
/**
 * LLM grader evaluation harness.
 *
 *   node src/eval/runHarness.js [path/to/dataset.json] [--live]
 *
 * Dataset shape: { passRatio, tolerance, items: [{ questionId, maxScore, human, ai? , question?, answerText? }] }
 *
 *  - Offline (default): each item already has `ai` (e.g. exported from a prior
 *    run). The harness just scores AI vs human. Reproducible, no API cost.
 *  - Live (--live): items provide a rubric `question` + `answerText`; the harness
 *    calls the real grader to produce `ai`. Requires GROQ_API_KEY.
 *
 * Prints MAE / RMSE / correlation / % within tolerance / pass-fail F1 — the
 * numbers that quantify grader accuracy.
 */
const fs = require('fs');
const path = require('path');
const { scorecard } = require('./metrics');

async function loadPairs(dataset, live) {
  const items = dataset.items || [];
  if (!live) {
    const missing = items.filter((it) => typeof it.ai !== 'number');
    if (missing.length) {
      throw new Error(
        `${missing.length} items have no 'ai' score. Provide them, or run with --live (needs GROQ_API_KEY + question/answerText).`
      );
    }
    return items.map((it) => ({ human: it.human, ai: it.ai, maxScore: it.maxScore }));
  }

  // Live grading via the real pipeline.
  const { evaluateQuestion } = require('../ai/questionEvaluator');
  const pairs = [];
  for (const it of items) {
    const q = it.question || {
      questionNumber: it.questionId,
      questionText: it.questionText || '',
      maxMarks: it.maxScore,
      keyPoints: it.keyPoints || [],
      gradingCriteria: it.gradingCriteria || '',
    };
    const res = await evaluateQuestion(q, it.answerText || '');
    pairs.push({ human: it.human, ai: res.score, maxScore: it.maxScore });
    console.log(`  graded ${it.questionId}: ai=${res.score} human=${it.human}`);
  }
  return pairs;
}

function bar(value, width = 24) {
  if (value == null) return '—';
  const filled = Math.round(Math.max(0, Math.min(1, value)) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

async function main() {
  const args = process.argv.slice(2);
  const live = args.includes('--live');
  const file = args.find((a) => !a.startsWith('--')) || path.join(__dirname, 'dataset.sample.json');

  const dataset = JSON.parse(fs.readFileSync(file, 'utf8'));
  const opts = { tolerance: dataset.tolerance ?? 1, passRatio: dataset.passRatio ?? 0.4 };

  const pairs = await loadPairs(dataset, live);
  const card = scorecard(pairs, opts);

  console.log('\n══════════════════════ AI GRADER SCORECARD ══════════════════════');
  console.log(
    `Dataset: ${path.basename(file)}   (${card.n} graded questions, ${live ? 'LIVE' : 'offline'})\n`
  );
  console.log(`  MAE (mean abs error)     ${card.mae} marks`);
  console.log(`  RMSE                     ${card.rmse} marks`);
  console.log(`  Pearson r (human vs AI)  ${card.pearson}   ${bar((card.pearson + 1) / 2)}`);
  console.log(`  Spearman rho             ${card.spearman}   ${bar((card.spearman + 1) / 2)}`);
  console.log(
    `  Within ${opts.tolerance} mark           ${(card.withinOneMark * 100).toFixed(1)}%   ${bar(card.withinOneMark)}`
  );
  console.log('\n  Pass/Fail agreement:');
  const pf = card.passFail;
  console.log(
    `    accuracy ${(pf.accuracy * 100).toFixed(1)}%  precision ${pf.precision}  recall ${pf.recall}  F1 ${pf.f1}`
  );
  console.log(`    confusion  TP=${pf.tp} FP=${pf.fp} TN=${pf.tn} FN=${pf.fn}`);
  console.log('═════════════════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Harness failed:', err.message);
  process.exit(1);
});
