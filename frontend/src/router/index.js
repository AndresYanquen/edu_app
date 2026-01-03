import { createRouter, createWebHistory } from 'vue-router';
import { watch } from 'vue';
import { useAuthStore } from '../stores/auth';

const Login = () => import('../views/Login.vue');
const StudentDashboard = () => import('../views/StudentDashboard.vue');
const Course = () => import('../views/Course.vue');
const InstructorDashboard = () => import('../views/InstructorDashboard.vue');
const InstructorGroup = () => import('../views/InstructorGroup.vue');
const Lesson = () => import('../views/Lesson.vue');
const AdminHome = () => import('../views/AdminHome.vue');
const CmsCourses = () => import('../views/CmsCourses.vue');
const CmsCourseBuilder = () => import('../views/CmsCourseBuilder.vue');
const CmsLessonEditor = () => import('../views/CmsLessonEditor.vue');
const ActivateAccount = () => import('../views/ActivateAccount.vue');

const routes = [
  { path: '/login', name: 'login', component: Login, meta: { public: true } },
  { path: '/activate', name: 'activate', component: ActivateAccount, meta: { public: true } },
  { path: '/auth/login', redirect: '/login', meta: { public: true } },
  {
    path: '/student',
    name: 'student',
    component: StudentDashboard,
    meta: { requiresAuth: true, roles: ['student'] },
  },
  {
    path: '/student/course/:id',
    name: 'course',
    component: Course,
    meta: { requiresAuth: true, roles: ['student'] },
  },
  {
    path: '/student/course/:courseId/lesson/:lessonId',
    name: 'lesson',
    component: Lesson,
    meta: { requiresAuth: true, roles: ['student'] },
  },
  {
    path: '/instructor',
    name: 'instructor',
    component: InstructorDashboard,
    meta: { requiresAuth: true, roles: ['instructor'] },
  },
  {
    path: '/instructor/group/:id',
    name: 'instructor-group',
    component: InstructorGroup,
    meta: { requiresAuth: true, roles: ['instructor'] },
  },
  {
    path: '/admin',
    name: 'admin',
    component: AdminHome,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/cms/courses',
    name: 'cms-courses',
    component: CmsCourses,
    meta: { requiresAuth: true, requiresStaff: true },
  },
  {
    path: '/cms/courses/:id',
    name: 'cms-course-builder',
    component: CmsCourseBuilder,
    meta: { requiresAuth: true, requiresStaff: true },
  },
  {
    path: '/cms/lessons/:id/edit',
    name: 'cms-lesson-editor',
    component: CmsLessonEditor,
    meta: { requiresAuth: true, requiresStaff: true },
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

  if (to.meta.requiresAdmin && !auth.isAdmin) {
    return next(auth.getDefaultRoute());
  }

  if (to.meta.requiresStaff && !auth.isStaff) {
    return next(auth.getDefaultRoute());
  }

  const requiredRoles = Array.isArray(to.meta.roles) ? to.meta.roles : [];
  if (requiredRoles.length) {
    const hasAccess =
      auth.hasAnyRole(requiredRoles) ||
      (requiredRoles.includes('instructor') && auth.isAdmin);
    if (!hasAccess) {
      const isStudentRoute = requiredRoles.includes('student');
      const wantsPreview = to.query.preview === '1' || to.query.preview === 'true';
      if (
        isStudentRoute &&
        wantsPreview &&
        auth.hasAnyRole(['admin', 'instructor', 'content_editor'])
      ) {
        return next();
      }
      return next(auth.getDefaultRoute());
    }
  }

  return next();
});

export default router;
