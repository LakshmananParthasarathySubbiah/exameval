const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * Verify JWT access token.
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }
    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Access token expired' });
    }
    return res.status(401).json({ success: false, error: 'Invalid access token' });
  }
};

/**
 * Role guard factory. Usage: requireRole('ADMIN') or requireRole(['ADMIN', 'STAFF'])
 */
const requireRole = (...roles) => (req, res, next) => {
  const allowed = roles.flat();
  if (!req.user || !allowed.includes(req.user.role)) {
    logger.warn(`Access denied for user ${req.user?.id} — required: ${allowed.join(', ')}, got: ${req.user?.role}`);
    return res.status(403).json({ success: false, error: 'Insufficient permissions' });
  }
  next();
};

module.exports = { authenticate, requireRole };
