import { createRouter, createWebHistory } from 'vue-router';
import { watch } from 'vue';
import Login from '../views/Login.vue';
import StudentDashboard from '../views/StudentDashboard.vue';
import Course from '../views/Course.vue';
import InstructorDashboard from '../views/InstructorDashboard.vue';
import InstructorGroup from '../views/InstructorGroup.vue';
import Lesson from '../views/Lesson.vue';
import AdminHome from '../views/AdminHome.vue';
import CmsCourses from '../views/CmsCourses.vue';
import CmsCourseBuilder from '../views/CmsCourseBuilder.vue';
import CmsLessonEditor from '../views/CmsLessonEditor.vue';
import ActivateAccount from '../views/ActivateAccount.vue';
import { useAuthStore } from '../stores/auth';

const canAccess = (rolesMeta, auth) => {
  if (!rolesMeta) return true;
  const roles = Array.isArray(rolesMeta) ? rolesMeta : [rolesMeta];
  if (auth.hasAnyRole(roles)) {
    return true;
  }
  if (roles.includes('instructor') && auth.hasRole('admin')) {
    return true;
  }
  return false;
};

const routes = [
  { path: '/login', name: 'login', component: Login, meta: { public: true } },
  { path: '/activate', name: 'activate', component: ActivateAccount, meta: { public: true } },
  { path: '/auth/login', redirect: '/login', meta: { public: true } },
  {
    path: '/student',
    name: 'student',
    component: StudentDashboard,
    meta: { requiresAuth: true, role: 'student' },
  },
  {
    path: '/student/course/:id',
    name: 'course',
    component: Course,
    meta: { requiresAuth: true, role: 'student' },
  },
  {
    path: '/student/course/:courseId/lesson/:lessonId',
    name: 'lesson',
    component: Lesson,
    meta: { requiresAuth: true, role: 'student' },
  },
  {
    path: '/instructor',
    name: 'instructor',
    component: InstructorDashboard,
    meta: { requiresAuth: true, role: 'instructor' },
  },
  {
    path: '/instructor/group/:id',
    name: 'instructor-group',
    component: InstructorGroup,
    meta: { requiresAuth: true, role: 'instructor' },
  },
  {
    path: '/admin',
    name: 'admin',
    component: AdminHome,
    meta: { requiresAuth: true, role: 'admin' },
  },
  {
    path: '/cms/courses',
    name: 'cms-courses',
    component: CmsCourses,
    meta: { requiresAuth: true, roles: ['admin', 'instructor', 'content_editor', 'enrollment_manager'] },
  },
  {
    path: '/cms/courses/:id',
    name: 'cms-course-builder',
    component: CmsCourseBuilder,
    meta: { requiresAuth: true, roles: ['admin', 'instructor', 'content_editor', 'enrollment_manager'] },
  },
  {
    path: '/cms/lessons/:id/edit',
    name: 'cms-lesson-editor',
    component: CmsLessonEditor,
    meta: { requiresAuth: true, roles: ['admin', 'instructor', 'content_editor', 'enrollment_manager'] },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: () => {
      const auth = useAuthStore();
      if (!auth.isAuthenticated) {
        return '/login';
      }
      return auth.getDefaultRoute();
    },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to, from, next) => {
  const auth = useAuthStore();

  if (!auth.initialized) {
    await new Promise((resolve) => {
      const stop = watch(
        () => auth.initialized,
        (val) => {
          if (val) {
            stop();
            resolve();
          }
        },
        { immediate: true },
      );
    });
  }

  if (to.meta.public) {
    if (to.path === '/login' && auth.isAuthenticated) {
      return next(auth.getDefaultRoute());
    }
    return next();
  }

  if (!auth.isAuthenticated) {
    return next('/login');
  }

  const requiredRoles = to.meta.roles || to.meta.role;
  if (!canAccess(requiredRoles, auth)) {
    const isStudentRoute =
      to.meta.role === 'student' ||
      (Array.isArray(to.meta.roles) && to.meta.roles.includes('student'));
    const wantsPreview = to.query.preview === '1' || to.query.preview === 'true';
    if (isStudentRoute && wantsPreview && auth.hasAnyRole(['admin', 'instructor', 'content_editor'])) {
      return next();
    }
    return next(auth.getDefaultRoute());
  }

  return next();
});

export default router;
