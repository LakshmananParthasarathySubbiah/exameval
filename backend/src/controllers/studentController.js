const { validationResult } = require('express-validator');
const studentService = require('../services/studentService');

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

async function getStudents(req, res, next) {
  try {
    const { page = 1, limit = 20, examId } = req.query;
    const result = await studentService.getStudents({ page: +page, limit: +limit, examId });
    res.json({ success: true, data: result.students, pagination: result.pagination });
  } catch (err) { next(err); }
}

async function createStudent(req, res, next) {
  try {
    validate(req);
    // Support array (bulk) or single
    if (Array.isArray(req.body)) {
      const result = await studentService.bulkCreateStudents(req.body);
      res.status(201).json({ success: true, data: result });
    } else {
      const student = await studentService.createStudent(req.body);
      res.status(201).json({ success: true, data: student });
    }
  } catch (err) { next(err); }
}

async function updateStudent(req, res, next) {
  try {
    validate(req);
    const student = await studentService.updateStudent(req.params.id, req.body);
    res.json({ success: true, data: student });
  } catch (err) { next(err); }
}

async function deleteStudent(req, res, next) {
  try {
    await studentService.deleteStudent(req.params.id);
    res.json({ success: true, data: { message: 'Student deleted' } });
  } catch (err) { next(err); }
}

module.exports = { getStudents, createStudent, updateStudent, deleteStudent };
