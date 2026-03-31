const auditService = require('../services/auditService');

async function getAuditLogs(req, res, next) {
  try {
    const { evaluationId, page = 1, limit = 50 } = req.query;
    const result = await auditService.getAuditLogs({ evaluationId, page: +page, limit: +limit });
    res.json({ success: true, data: result.logs, pagination: result.pagination });
  } catch (err) { next(err); }
}

module.exports = { getAuditLogs };
