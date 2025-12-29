const { requireGlobalRoleAny } = require('./roles');

module.exports = function legacyRequireRole(allowedRoles = []) {
  return requireGlobalRoleAny(allowedRoles);
};
