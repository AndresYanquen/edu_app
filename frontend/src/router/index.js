import { createRouter, createWebHistory } from 'vue-router';
import { watch } from 'vue';
import { useAuthStore } from '../stores/auth';

const Login = () => import('../views/Login.vue');
const StudentDashboard = () => import('../views/StudentDashboard.vue');
const Course = () => import('../views/Course.vue');
const InstructorDashboard = () => import('../views/InstructorDashboard.vue');
const InstructorGroup = () => import('../views/InstructorGroup.vue');
const Lesson = () => import('../views/Lesson.vue');
const AdminLayout = () => import('../views/admin/AdminLayout.vue');
const DashboardView = () => import('../views/admin/DashboardView.vue');
const UsersView = () => import('../views/admin/UsersView.vue');
const InvitationsView = () => import('../views/admin/InvitationsView.vue');
const CourseLevelsView = () => import('../views/admin/CourseLevelsView.vue');
const SettingsView = () => import('../views/admin/SettingsView.vue');
const CmsCourses = () => import('../views/CmsCourses.vue');
const CmsCourseBuilder = () => import('../views/CmsCourseBuilder.vue');
const CmsCourseSummaryTab = () => import('../views/cms/courses/tabs/CmsCourseSummaryTab.vue');
const CmsCourseBuildTab = () => import('../views/cms/courses/tabs/CmsCourseBuildTab.vue');
const CmsCourseGroupsTab = () => import('../views/cms/courses/tabs/CmsCourseGroupsTab.vue');
const CmsCourseAnnouncementsRouteTab = () => import('../views/cms/courses/tabs/CmsCourseAnnouncementsRouteTab.vue');
const CmsCoursePostsRouteTab = () => import('../views/cms/courses/tabs/CmsCoursePostsRouteTab.vue');
const CmsCourseLiveSessionsTab = () => import('../views/cms/courses/tabs/CmsCourseLiveSessionsTab.vue');
const CmsCourseAttendanceRouteTab = () => import('../views/cms/courses/tabs/CmsCourseAttendanceRouteTab.vue');
const CmsCourseInstructorsTab = () => import('../views/cms/courses/tabs/CmsCourseInstructorsTab.vue');
const CmsCourseEnrollmentsTab = () => import('../views/cms/courses/tabs/CmsCourseEnrollmentsTab.vue');
const CmsCourseStaffTab = () => import('../views/cms/courses/tabs/CmsCourseStaffTab.vue');
const CmsLessonEditor = () => import('../views/CmsLessonEditor.vue');
const ActivateAccount = () => import('../views/ActivateAccount.vue');
const LandingPage = () => import('../views/LandingPage.vue');

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
    component: AdminLayout,
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      {
        path: '',
        name: 'admin-dashboard',
        component: DashboardView,
        meta: { requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'users',
        name: 'admin-users',
        component: UsersView,
        meta: { requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'invitations',
        name: 'admin-invitations',
        component: InvitationsView,
        meta: { requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'course-levels',
        name: 'admin-course-levels',
        component: CourseLevelsView,
        meta: { requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'settings',
        name: 'admin-settings',
        component: SettingsView,
        meta: { requiresAuth: true, requiresAdmin: true },
      },
    ],
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
    children: [
      {
        path: 'summary',
        name: 'cms-course-summary',
        component: CmsCourseSummaryTab,
        meta: { requiresAuth: true, requiresStaff: true, cmsCourseTabKey: 'summary' },
      },
      {
        path: 'build',
        name: 'cms-course-build',
        component: CmsCourseBuildTab,
        meta: { requiresAuth: true, requiresStaff: true, cmsCourseTabKey: 'build' },
      },
      {
        path: 'groups',
        name: 'cms-course-groups',
        component: CmsCourseGroupsTab,
        meta: { requiresAuth: true, requiresStaff: true, cmsCourseTabKey: 'groups' },
      },
      {
        path: 'announcements',
        name: 'cms-course-announcements',
        component: CmsCourseAnnouncementsRouteTab,
        meta: { requiresAuth: true, requiresStaff: true, cmsCourseTabKey: 'announcements' },
      },
      {
        path: 'posts',
        name: 'cms-course-posts',
        component: CmsCoursePostsRouteTab,
        meta: { requiresAuth: true, requiresStaff: true, cmsCourseTabKey: 'posts' },
      },
      {
        path: 'live-sessions',
        name: 'cms-course-live-sessions',
        component: CmsCourseLiveSessionsTab,
        meta: { requiresAuth: true, requiresStaff: true, cmsCourseTabKey: 'live' },
      },
      {
        path: 'attendance',
        name: 'cms-course-attendance',
        component: CmsCourseAttendanceRouteTab,
        meta: { requiresAuth: true, requiresStaff: true, cmsCourseTabKey: 'attendance' },
      },
      {
        path: 'instructors',
        name: 'cms-course-instructors',
        component: CmsCourseInstructorsTab,
        meta: { requiresAuth: true, requiresStaff: true, cmsCourseTabKey: 'instructors' },
      },
      {
        path: 'enrollments',
        name: 'cms-course-enrollments',
        component: CmsCourseEnrollmentsTab,
        meta: { requiresAuth: true, requiresStaff: true, cmsCourseTabKey: 'enrollments' },
      },
      {
        path: 'staff',
        name: 'cms-course-staff',
        component: CmsCourseStaffTab,
        meta: { requiresAuth: true, requiresStaff: true, cmsCourseTabKey: 'staff' },
      },
    ],
  },
  {
    path: '/cms/lessons/:id/edit',
    name: 'cms-lesson-editor',
    component: CmsLessonEditor,
    meta: { requiresAuth: true, requiresStaff: true },
  },
  {
    path: '/',
    name: 'landing',
    component: LandingPage,
    meta: { public: true, hideSidebar: true },
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
