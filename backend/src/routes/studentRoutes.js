const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/studentController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', controller.getStudents);

router.post('/', [
  body('*.name').optional().trim().notEmpty(),
  body('name').optional().trim().notEmpty(),
  body('rollNumber').optional().trim().notEmpty(),
  body('examId').optional().notEmpty(),
], controller.createStudent);

router.put('/:id', [
  body('name').optional().trim().notEmpty(),
  body('rollNumber').optional().trim().notEmpty(),
  body('email').optional().isEmail(),
], controller.updateStudent);

router.delete('/:id', controller.deleteStudent);

module.exports = router;
