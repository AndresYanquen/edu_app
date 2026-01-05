const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ACCESS_TOKEN_TTL_MIN = Number(process.env.ACCESS_TOKEN_TTL_MIN || 10);
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 14);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '';
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || 'none').toLowerCase();
const COOKIE_SECURE =
  typeof process.env.COOKIE_SECURE === 'string'
    ? process.env.COOKIE_SECURE.toLowerCase() === 'true'
    : FRONTEND_ORIGIN.startsWith('https') || process.env.NODE_ENV === 'production';

const buildCookieOptions = () => ({
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: ['lax', 'strict', 'none'].includes(COOKIE_SAMESITE) ? COOKIE_SAMESITE : 'lax',
  path: '/',
  maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
});

const createAccessToken = (payload) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be defined to issue tokens');
  }

  return jwt.sign(payload, process.env.JWT_SECRET, {
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
