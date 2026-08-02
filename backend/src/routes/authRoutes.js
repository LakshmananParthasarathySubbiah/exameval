const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

router.post(
  '/register',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').optional().isIn(['ADMIN', 'STAFF']),
  ],
  controller.register
);

router.post(
  '/login',
  authLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  controller.login
);

router.post('/refresh', authLimiter, controller.refresh);
router.post('/logout', authenticate, controller.logout);

module.exports = router;
