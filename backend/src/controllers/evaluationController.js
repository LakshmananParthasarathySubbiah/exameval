const evaluationService = require('../services/evaluationService');
const auditService = require('../services/auditService');
const { sseConnect } = require('../utils/sseManager');
const logger = require('../utils/logger');

async function getEvaluations(req, res, next) {
  try {
    const { page = 1, limit = 20, examId, status } = req.query;
    const result = await evaluationService.getEvaluations({ page: +page, limit: +limit, examId, status });
    res.json({ success: true, data: result.evaluations, pagination: result.pagination });
  } catch (err) { next(err); }
}

async function getEvaluation(req, res, next) {
  try {
    const evaluation = await evaluationService.getEvaluationById(req.params.id);
    res.json({ success: true, data: evaluation });
  } catch (err) { next(err); }
}

async function runEvaluation(req, res, next) {
  try {
    const evaluation = await evaluationService.runEvaluation(req.params.scriptId, req.user.id);
    res.status(202).json({ success: true, data: { evaluationId: evaluation.id, status: evaluation.status } });
  } catch (err) { next(err); }
}

async function runBatchEvaluation(req, res, next) {
  try {
    const { scriptIds } = req.body;
    if (!Array.isArray(scriptIds) || scriptIds.length === 0) {
      return res.status(400).json({ success: false, error: 'scriptIds must be a non-empty array' });
    }
    const results = await evaluationService.runBatchEvaluation(scriptIds, req.user.id);
    res.status(202).json({ success: true, data: results });
  } catch (err) { next(err); }
}

async function retryEvaluation(req, res, next) {
  try {
    const result = await evaluationService.retryEvaluation(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function reviewEvaluation(req, res, next) {
  try {
    const { overrideScore, staffNotes, staffReviewed } = req.body;
    const updated = await evaluationService.reviewEvaluation(
      req.params.id,
      { overrideScore, staffNotes, staffReviewed },
      req.user.id
    );
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

async function streamEvents(req, res, next) {
  try {
    const { id } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    sseConnect(id, res);

    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ status: 'CONNECTED', evaluationId: id })}\n\n`);
  } catch (err) { next(err); }
}

async function getExamSummary(req, res, next) {
  try {
    const { examId } = req.query;
    if (!examId) return res.status(400).json({ success: false, error: 'examId is required' });
    const summary = await evaluationService.getExamSummary(examId);
    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
}

module.exports = {
  getEvaluations,
  getEvaluation,
  runEvaluation,
  runBatchEvaluation,
  retryEvaluation,
  reviewEvaluation,
  streamEvents,
  getExamSummary,
};
