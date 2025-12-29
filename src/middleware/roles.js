const {
  hasCourseRole,
  getCourseIdFromLesson,
  getCourseIdFromGroup,
  getCourseIdFromModule,
  ensureCourseExists,
} = require('../utils/roleService');

const extractGlobalRoles = (user) => {
  if (!user) {
    return [];
  }
  if (Array.isArray(user.globalRoles) && user.globalRoles.length) {
    return user.globalRoles;
  }
  if (user.role) {
    return [user.role];
  }
  return [];
};

const hasGlobalRole = (user, roleName) => extractGlobalRoles(user).includes(roleName);

const requireGlobalRoleAny = (allowedRoles = []) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userRoles = extractGlobalRoles(req.user);
  if (!userRoles.length) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const allowed =
    allowedRoles.length === 0 || allowedRoles.some((role) => userRoles.includes(role));

  if (!allowed) {
    return res.status(403).json({ error: 'You are not allowed to perform this action' });
  }

  return next();
};

const resolveCourseId = async (resolver, req) =>
  typeof resolver === 'function' ? resolver(req) : resolver;

const requireCourseRoleAny = (courseResolver, allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const resolved = await resolveCourseId(courseResolver, req);
      const courseId = typeof resolved === 'string' ? resolved : resolved?.courseId;

      if (!courseId) {
        return res.status(404).json({ error: 'Course not found' });
      }

      const course = await ensureCourseExists(courseId);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      if (hasGlobalRole(req.user, 'admin')) {
        req.courseContext = { ...(req.courseContext || {}), courseId: course.id, course };
        return next();
      }

      if (!allowedRoles.length) {
        return res.status(403).json({ error: 'You are not allowed to perform this action' });
      }

      const allowed =
        (allowedRoles.includes('instructor') && course.owner_user_id === req.user.id) ||
        (await hasCourseRole(req.user.id, course.id, allowedRoles));
      if (!allowed) {
        return res.status(403).json({ error: 'You are not allowed to perform this action' });
      }

      req.courseContext = { ...(req.courseContext || {}), courseId: course.id, course };
      return next();
    } catch (err) {
      console.error('Course role verification failed', err);
      return res.status(500).json({ error: 'Failed to verify course permissions' });
    }
  };
};

module.exports = {
  requireGlobalRoleAny,
  requireCourseRoleAny,
  hasCourseRole,
  hasGlobalRole,
  getCourseIdFromLesson,
  getCourseIdFromGroup,
  getCourseIdFromModule,
};
