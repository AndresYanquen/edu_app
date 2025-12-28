const crypto = require('crypto');

const DEFAULT_INVITE_TTL_DAYS = Number(process.env.USER_INVITE_TTL_DAYS || 7);

const hashInviteToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const generateInviteToken = (ttlDays = DEFAULT_INVITE_TTL_DAYS) => {
  const days = Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : DEFAULT_INVITE_TTL_DAYS;
  const token = crypto.randomBytes(32).toString('base64url');
  const hash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return { token, hash, expiresAt };
};

module.exports = {
  hashInviteToken,
  generateInviteToken,
  DEFAULT_INVITE_TTL_DAYS,
};
