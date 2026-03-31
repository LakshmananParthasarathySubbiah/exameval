const { validationResult } = require('express-validator');
const examService = require('../services/examService');

const validate = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new Error('Validation failed');
    err.type = 'validation';
    err.errors = errors.array();
    err.status = 422;
    throw err;
  }
};

async function getExams(req, res, next) {
  try {
    const { page = 1, limit = 20, courseId } = req.query;
    const result = await examService.getExams({ page: +page, limit: +limit, courseId });
    res.json({ success: true, data: result.exams, pagination: result.pagination });
  } catch (err) { next(err); }
}

async function getExam(req, res, next) {
  try {
    const exam = await examService.getExamById(req.params.id);
    res.json({ success: true, data: exam });
  } catch (err) { next(err); }
}

async function createExam(req, res, next) {
  try {
    validate(req);
    const exam = await examService.createExam({ ...req.body, rubricFile: req.file });
    res.status(201).json({ success: true, data: exam });
  } catch (err) { next(err); }
}

async function updateExam(req, res, next) {
  try {
    const exam = await examService.updateExam(req.params.id, { ...req.body, rubricFile: req.file });
    res.json({ success: true, data: exam });
  } catch (err) { next(err); }
}

async function deleteExam(req, res, next) {
  try {
    await examService.deleteExam(req.params.id);
    res.json({ success: true, data: { message: 'Exam deleted' } });
  } catch (err) { next(err); }
}

module.exports = { getExams, getExam, createExam, updateExam, deleteExam };
