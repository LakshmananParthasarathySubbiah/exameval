const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/courseController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/', controller.getCourses);

router.post('/', requireRole('ADMIN'), [
  body('name').trim().notEmpty().withMessage('Course name is required'),
  body('code').trim().notEmpty().withMessage('Course code is required'),
], controller.createCourse);

router.put('/:id', requireRole('ADMIN'), [
  body('name').optional().trim().notEmpty(),
  body('code').optional().trim().notEmpty(),
], controller.updateCourse);

router.delete('/:id', requireRole('ADMIN'), controller.deleteCourse);

module.exports = router;
