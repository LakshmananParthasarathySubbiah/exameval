const { validationResult } = require('express-validator');
const scriptService = require('../services/scriptService');
const logger = require('../utils/logger');

async function getScripts(req, res, next) {
  try {
    const { page = 1, limit = 20, examId, studentId } = req.query;
    const result = await scriptService.getScripts({ page: +page, limit: +limit, examId, studentId });
    res.json({ success: true, data: result.scripts, pagination: result.pagination });
  } catch (err) { next(err); }
}

async function getScript(req, res, next) {
  try {
    const script = await scriptService.getScriptById(req.params.id);
    res.json({ success: true, data: script });
  } catch (err) { next(err); }
}

async function uploadScript(req, res, next) {
  try {
    const { studentId, examId } = req.body;
    if (!studentId || !examId) {
      return res.status(400).json({ success: false, error: 'studentId and examId are required' });
    }

    if (req.files && req.files.length > 1) {
      // Bulk upload — requires studentIds array matching file count
      const studentIds = JSON.parse(req.body.studentIds || '[]');
      if (studentIds.length !== req.files.length) {
        return res.status(400).json({ success: false, error: 'studentIds count must match file count' });
      }
      const fileData = req.files.map((f, i) => ({
        studentId: studentIds[i],
        examId,
        filePath: f.path,
      }));
      await scriptService.bulkCreateScripts(fileData);
      return res.status(201).json({ success: true, data: { count: req.files.length } });
    }

    const file = req.file || (req.files && req.files[0]);
    if (!file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    const script = await scriptService.createScript({ studentId, examId, filePath: file.path });
    res.status(201).json({ success: true, data: script });
  } catch (err) { next(err); }
}

async function deleteScript(req, res, next) {
  try {
    await scriptService.deleteScript(req.params.id);
    res.json({ success: true, data: { message: 'Script deleted' } });
  } catch (err) { next(err); }
}

module.exports = { getScripts, getScript, uploadScript, deleteScript };
