const router = require('express').Router();
const controller = require('../controllers/assistantController');
const { authenticate } = require('../middleware/auth');
const { evaluationLimiter } = require('../middleware/rateLimit');

router.use(authenticate);

// LLM-backed → reuse the evaluation rate limiter (cost control).
router.post('/ask', evaluationLimiter, controller.ask);

module.exports = router;
