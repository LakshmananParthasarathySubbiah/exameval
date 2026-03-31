const { validationResult } = require('express-validator');
const authService = require('../services/authService');
const logger = require('../utils/logger');

const formatErrors = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new Error('Validation failed');
    err.type = 'validation';
    err.errors = errors.array();
    err.status = 422;
    throw err;
  }
};

async function register(req, res, next) {
  try {
    formatErrors(req);
    const user = await authService.register(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    formatErrors(req);
    const result = await authService.login(req.body);
    res
      .cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({ success: true, data: { accessToken: result.accessToken, user: result.user } });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) return res.status(401).json({ success: false, error: 'No refresh token provided' });

    const result = await authService.refresh(token);
    res
      .cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({ success: true, data: { accessToken: result.accessToken } });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    await authService.logout(req.user.id);
    res.clearCookie('refreshToken').json({ success: true, data: { message: 'Logged out' } });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, refresh, logout };
