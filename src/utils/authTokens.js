const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const ACCESS_TOKEN_TTL_MIN = env.ACCESS_TOKEN_TTL_MIN;
const REFRESH_TOKEN_TTL_DAYS = env.REFRESH_TOKEN_TTL_DAYS;
const isProduction = env.NODE_ENV === 'production';

const buildCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/',
  maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
});

const createAccessToken = (payload) => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: `${ACCESS_TOKEN_TTL_MIN}m`,
  });
};

const hashRefreshToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const generateRefreshToken = () => {
  const token = crypto.randomBytes(48).toString('base64url');
  const hash = hashRefreshToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  return { token, hash, expiresAt };
};

module.exports = {
  createAccessToken,
  generateRefreshToken,
  buildCookieOptions,
  hashRefreshToken,
};
