const router = require('express').Router();
const controller = require('../controllers/evaluationController');
const { authenticate } = require('../middleware/auth');
const { evaluationLimiter } = require('../middleware/rateLimit');

router.use(authenticate);

router.get('/', controller.getEvaluations);
router.get('/summary', controller.getExamSummary);
router.get('/:id', controller.getEvaluation);
router.get('/:id/events', controller.streamEvents);

router.post('/run/:scriptId', evaluationLimiter, controller.runEvaluation);
router.post('/run-batch', evaluationLimiter, controller.runBatchEvaluation);
router.post('/:id/retry', evaluationLimiter, controller.retryEvaluation);
router.patch('/:id/review', controller.reviewEvaluation);

module.exports = router;
