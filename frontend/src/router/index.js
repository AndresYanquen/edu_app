import { createRouter, createWebHistory } from 'vue-router';
import { watch } from 'vue';
import Login from '../views/Login.vue';
import StudentDashboard from '../views/StudentDashboard.vue';
import Course from '../views/Course.vue';
import InstructorDashboard from '../views/InstructorDashboard.vue';
import InstructorGroup from '../views/InstructorGroup.vue';
import Lesson from '../views/Lesson.vue';
import AdminHome from '../views/AdminHome.vue';
import { useAuthStore } from '../stores/auth';

const roleHome = {
  student: '/student',
  instructor: '/instructor',
  admin: '/admin',
};

const canAccess = (routeRole, userRole) => {
  if (!routeRole) return true;
  if (routeRole === userRole) return true;
  if (routeRole === 'instructor' && userRole === 'admin') return true;
  return false;
};

const routes = [
  { path: '/login', name: 'login', component: Login, meta: { public: true } },
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
  { path: '/:pathMatch(.*)*', redirect: '/login' },
  {
    path: '/:pathMatch(.*)*',
    redirect: () => (useAuthStore().isAuthenticated ? (roleHome[useAuthStore().role] || '/student') : '/login'),
  }
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
            stop()
            resolve()
          }
        },
        { immediate: true },
      )
    })
  }

  if (to.meta.public) {
    if (to.path === '/login' && auth.isAuthenticated) {
      return next(roleHome[auth.role] || '/student');
    }
    return next();
  }

  if (!auth.isAuthenticated) {
    return next('/login');
  }

  if (!canAccess(to.meta.role, auth.role)) {
    return next(roleHome[auth.role] || '/student');
  }

  return next();
});

export default router;
