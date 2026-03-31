const router = require('express').Router();
const controller = require('../controllers/evaluationController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/', controller.getEvaluations);
router.get('/summary', controller.getExamSummary);
router.get('/:id', controller.getEvaluation);
router.get('/:id/events', controller.streamEvents);

router.post('/run/:scriptId', controller.runEvaluation);
router.post('/run-batch', controller.runBatchEvaluation);
router.post('/:id/retry', controller.retryEvaluation);
router.patch('/:id/review', controller.reviewEvaluation);

module.exports = router;
