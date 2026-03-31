const { validationResult } = require('express-validator');
const courseService = require('../services/courseService');

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

async function getCourses(req, res, next) {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const result = await courseService.getCourses({ page: +page, limit: +limit, search });
    res.json({ success: true, data: result.courses, pagination: result.pagination });
  } catch (err) { next(err); }
}

async function createCourse(req, res, next) {
  try {
    validate(req);
    const course = await courseService.createCourse(req.body);
    res.status(201).json({ success: true, data: course });
  } catch (err) { next(err); }
}

async function updateCourse(req, res, next) {
  try {
    validate(req);
    const course = await courseService.updateCourse(req.params.id, req.body);
    res.json({ success: true, data: course });
  } catch (err) { next(err); }
}

async function deleteCourse(req, res, next) {
  try {
    await courseService.deleteCourse(req.params.id);
    res.json({ success: true, data: { message: 'Course deleted' } });
  } catch (err) { next(err); }
}

module.exports = { getCourses, createCourse, updateCourse, deleteCourse };
