const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../utils/logger');
const prisma = require('../utils/prisma');

/**
 * Hash a refresh token before persisting it. Refresh tokens are high-entropy
 * JWTs, so a fast SHA-256 is appropriate (and avoids bcrypt's 72-byte
 * truncation). Storing only the hash means a DB leak can't be used to mint
 * sessions; the raw token is returned to the client and never stored.
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateAccessToken(userId, role) {
  return jwt.sign({ userId, role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  });
}

function generateRefreshToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  });
}

async function register({ email, password, role = 'STAFF' }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const err = new Error('Email already registered');
    err.status = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, role },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  logger.info(`User registered: ${email} (${role})`);
  return user;
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: hashToken(refreshToken) },
  });

  logger.info(`User logged in: ${email}`);
  return {
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, role: user.role },
  };
}

async function refresh(token) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    const err = new Error('Invalid or expired refresh token');
    err.status = 401;
    throw err;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.refreshToken || user.refreshToken !== hashToken(token)) {
    const err = new Error('Refresh token revoked or not found');
    err.status = 401;
    throw err;
  }

  const accessToken = generateAccessToken(user.id, user.role);
  const newRefreshToken = generateRefreshToken(user.id);
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: hashToken(newRefreshToken) },
  });

  return { accessToken, refreshToken: newRefreshToken };
}

async function logout(userId) {
  await prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });
  logger.info(`User logged out: ${userId}`);
}

module.exports = { register, login, refresh, logout };
