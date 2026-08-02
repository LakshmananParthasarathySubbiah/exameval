const router = require('express').Router();
const controller = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/exam/:examId', controller.getExamAnalytics);

module.exports = router;
