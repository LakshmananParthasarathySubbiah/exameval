const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/examController');
const { authenticate, requireRole } = require('../middleware/auth');
const { uploadRubric } = require('../middleware/upload');

router.use(authenticate);

router.get('/', controller.getExams);
router.get('/:id', controller.getExam);

router.post('/', (req, res, next) => {
  req.uploadSubDir = 'rubrics';
  next();
}, uploadRubric.single('rubricFile'), [
  body('title').trim().notEmpty().withMessage('Exam title is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('courseId').notEmpty().withMessage('courseId is required'),
], controller.createExam);

router.put('/:id', (req, res, next) => {
  req.uploadSubDir = 'rubrics';
  next();
}, uploadRubric.single('rubricFile'), controller.updateExam);

router.delete('/:id', requireRole('ADMIN'), controller.deleteExam);

module.exports = router;
