const router = require('express').Router();
const controller = require('../controllers/auditController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate, requireRole('ADMIN'));
router.get('/', controller.getAuditLogs);

module.exports = router;
