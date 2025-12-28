const crypto = require('crypto');

const INVITE_TTL_DAYS = Number(process.env.USER_INVITE_TTL_DAYS || 7);

const hashInviteToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const generateInviteToken = () => {
  const token = crypto.randomBytes(32).toString('base64url');
  const hash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { token, hash, expiresAt };
};

module.exports = {
  hashInviteToken,
  generateInviteToken,
  INVITE_TTL_DAYS,
};
