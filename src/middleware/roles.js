const {
  hasCourseRole,
  getCourseIdFromLesson,
  getCourseIdFromGroup,
  getCourseIdFromModule,
  ensureCourseExists,
  isGroupTeacher,
} = require('../utils/roleService');

const extractGlobalRoles = (user) =>
  Array.isArray(user?.globalRoles) ? user.globalRoles : [];

const hasGlobalRole = (user, roleName) => extractGlobalRoles(user).includes(roleName);

const requireGlobalRoleAny = (allowedRoles = []) => (req, res, next) => {
    console.log(req.method, req.path, allowedRoles, req.user?.globalRoles);
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userRoles = extractGlobalRoles(req.user);
  if (!userRoles.length) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  console.log('roles seen', userRoles);
  console.log('allowed roles', allowedRoles);
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

const resolveGroupId = async (resolver, req) =>
  typeof resolver === 'function' ? resolver(req) : resolver;

const requireGroupTeacherOrAdmin = (groupResolver) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const resolved = await resolveGroupId(groupResolver, req);
      const groupId = typeof resolved === 'string' ? resolved : resolved?.groupId;
      if (!groupId) {
        return res.status(404).json({ error: 'Group not found' });
      }

      const courseId = await getCourseIdFromGroup(groupId);
      if (!courseId) {
        return res.status(404).json({ error: 'Group not found' });
      }

      if (hasGlobalRole(req.user, 'admin')) {
        req.groupContext = { ...(req.groupContext || {}), groupId, courseId };
        return next();
      }

      const allowed = await isGroupTeacher(req.user.id, groupId);
      if (!allowed) {
        return res.status(403).json({ error: 'You are not allowed to perform this action' });
      }

      req.groupContext = { ...(req.groupContext || {}), groupId, courseId };
      return next();
    } catch (err) {
      console.error('Group role verification failed', err);
      return res.status(500).json({ error: 'Failed to verify group permissions' });
    }
  };
};

module.exports = {
  requireGlobalRoleAny,
  requireCourseRoleAny,
  requireGroupTeacherOrAdmin,
  hasCourseRole,
  hasGlobalRole,
  getCourseIdFromLesson,
  getCourseIdFromGroup,
  getCourseIdFromModule,
  resolveCourseId
};
