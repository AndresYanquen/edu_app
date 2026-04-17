<template>
  <div class="shell">
    <!-- MOBILE TOPBAR -->
    <header v-if="showSidebar" class="mobile-topbar">
      <Button
        icon="pi pi-bars"
        class="p-button-rounded p-button-text mobile-menu-btn"
        :aria-label="t('sidebar.toggle')"
        @click="mobileSidebarOpen = true"
      />

      <div class="mobile-brand">
  <Avatar label="AC" shape="circle" class="mobile-brand-avatar" />
  <div class="mobile-brand-copy">
    <strong>{{ t('common.brandTitle') }}</strong>
    <small>{{ t('common.brandSubtitle') }}</small>
  </div>
</div>
    </header>

    <!-- DESKTOP SIDEBAR -->
    <aside
  v-if="showSidebar"
  :class="['sidebar', 'desktop-sidebar', { collapsed }]"
>
      <div class="sidebar-inner">
        <div class="sidebar-header">
          <div class="brand-block">
            <Avatar label="AC" shape="circle" size="large" class="brand-avatar" />
            <div class="brand-copy" v-if="!collapsed">
              <strong>{{ t('common.brandTitle') }}</strong>
              <small>{{ t('common.brandSubtitle') }}</small>
            </div>
          </div>

          <Button
            :icon="toggleIcon"
            class="p-button-rounded p-button-text collapse-btn"
            @click="toggleSidebar"
            :aria-label="t('sidebar.toggle')"
          />
        </div>

        <div class="sidebar-section">
          <small v-if="!collapsed" class="section-label">
            {{ t('sidebar.workspace') }}
          </small>

          <div v-if="canShowNotifications" class="notifications-trigger">
            <Button
              class="nav-item bell-button"
              :class="{ 'nav-item-active': openNotifications }"
              :label="collapsed ? '' : 'Notificaciones'"
              icon="pi pi-bell"
              text
              @click="openNotifications = true"
              :aria-label="'Notificaciones'"
            />
            <span v-if="unreadBadge" class="bell-badge">{{ unreadBadge }}</span>
          </div>

          <div class="nav-list">
            <RouterLink
              v-for="link in navLinks"
              :key="link.name"
              :to="{ name: link.name }"
              custom
              v-slot="{ navigate, isActive }"
            >
              <Button
                class="nav-item"
                :class="{ 'nav-item-active': isActive || isActiveGroup(link) }"
                :label="collapsed ? '' : link.label"
                :icon="link.icon"
                text
                @click="navigate"
                :aria-label="link.label"
              />
            </RouterLink>
          </div>
        </div>

        <div class="language-switch">
          <i class="pi pi-globe" aria-hidden="true" />
          <span v-if="!collapsed" class="language-label">
            {{ t('sidebar.language') }}: <strong>{{ languageLabel }}</strong>
          </span>
          <InputSwitch v-model="languageToggle" :aria-label="t('sidebar.language')" />
        </div>

        <Divider class="sidebar-divider" />

        <div class="spacer" />

        <div class="user-card">
          <div class="user-info">
            <Avatar :label="initials" shape="circle" class="user-avatar" />
            <div class="container-user-info" v-if="!collapsed">
              <strong>{{ auth.user?.fullName }}</strong>
              <small>{{ auth.user?.email }}</small>
            </div>
          </div>

          <div class="user-actions" v-if="!collapsed">
            <Tag :value="roleSummary" severity="info" size="small" />
            <Button
              icon="pi pi-sign-out"
              class="p-button-rounded p-button-text logout-btn"
              :label="t('common.logout')"
              @click="handleLogout"
            />
          </div>
        </div>
      </div>
    </aside>

    <main class="shell-content">
      <slot />
    </main>

    <!-- MOBILE DRAWER -->
    <Sidebar
      v-model:visible="mobileSidebarOpen"
      position="left"
      class="mobile-drawer"
      :dismissable="true"
      :blockScroll="true"
      :showCloseIcon="false"
    >
      <div class="drawer-sidebar">
        <div class="drawer-header">
          <div class="brand-block">
            <Avatar label="AC" shape="circle" size="large" class="brand-avatar" />
            <div class="brand-copy">
              <strong>{{ t('common.brandTitle') }}</strong>
              <small>{{ t('common.brandSubtitle') }}</small>
            </div>
          </div>

          <Button
            icon="pi pi-times"
            class="p-button-rounded p-button-text collapse-btn"
            @click="mobileSidebarOpen = false"
            :aria-label="t('sidebar.toggle')"
          />
        </div>

        <div class="sidebar-section">
          <small class="section-label">
            {{ t('sidebar.workspace') }}
          </small>

          <div v-if="canShowNotifications" class="notifications-trigger">
            <Button
              class="nav-item bell-button"
              :class="{ 'nav-item-active': openNotifications }"
              label="Notificaciones"
              icon="pi pi-bell"
              text
              @click="handleOpenNotificationsFromMobile"
              :aria-label="'Notificaciones'"
            />
            <span v-if="unreadBadge" class="bell-badge">{{ unreadBadge }}</span>
          </div>

          <div class="nav-list">
            <RouterLink
              v-for="link in navLinks"
              :key="link.name"
              :to="{ name: link.name }"
              custom
              v-slot="{ navigate, isActive }"
            >
              <Button
                class="nav-item"
                :class="{ 'nav-item-active': isActive || isActiveGroup(link) }"
                :label="link.label"
                :icon="link.icon"
                text
                @click="
                  navigate();
                  mobileSidebarOpen = false;
                "
                :aria-label="link.label"
              />
            </RouterLink>
          </div>
        </div>

        <div class="language-switch language-switch-mobile">
          <i class="pi pi-globe" aria-hidden="true" />
          <span class="language-label">
            {{ t('sidebar.language') }}: <strong>{{ languageLabel }}</strong>
          </span>
          <InputSwitch v-model="languageToggle" :aria-label="t('sidebar.language')" />
        </div>

        <Divider class="sidebar-divider" />

        <div class="spacer" />

        <div class="user-card">
          <div class="user-info">
            <Avatar :label="initials" shape="circle" class="user-avatar" />
            <div class="container-user-info">
              <strong>{{ auth.user?.fullName }}</strong>
              <small>{{ auth.user?.email }}</small>
            </div>
          </div>

          <div class="user-actions">
            <Tag :value="roleSummary" severity="info" size="small" />
            <Button
              icon="pi pi-sign-out"
              class="p-button-rounded p-button-text logout-btn"
              :label="t('common.logout')"
              @click="handleLogout"
            />
          </div>
        </div>
      </div>
    </Sidebar>

    <!-- NOTIFICATIONS -->
    <AppSidebar
      v-model="openNotifications"
      title="Notificaciones"
      position="right"
      width="440px"
      @hide="handleNotificationsHide"
    >
      <NotificationsPanel
        v-if="canShowNotifications && openNotifications"
        :key="notificationsPanelKey"
        @unread-change="handleUnreadChange"
      />
    </AppSidebar>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Sidebar from 'primevue/sidebar';
import Avatar from 'primevue/avatar';
import Button from 'primevue/button';
import Divider from 'primevue/divider';
import InputSwitch from 'primevue/inputswitch';
import Tag from 'primevue/tag';

import { useAuthStore } from '../stores/auth';
import { useNotificationsStore } from '../stores/notifications';
import { pingPresence } from '../api/presence';
import AppSidebar from './ui/AppSidebar.vue';
import NotificationsPanel from './notifications/NotificationsPanel.vue';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const notifications = useNotificationsStore();

const collapsed = ref(true);
const mobileSidebarOpen = ref(false);
const openNotifications = ref(false);
const notificationsPanelKey = ref(0);

const { t, locale } = useI18n();

const studentLinks = computed(() => [
  { label: t('sidebar.studentDashboard'), name: 'student', icon: 'pi pi-home' },
  { label: 'Comunidad', name: 'student-community', icon: 'pi pi-comments' },
]);

const instructorLinks = computed(() => [
  { label: t('sidebar.instructorDashboard'), name: 'instructor', icon: 'pi pi-users' },
  { label: t('sidebar.cms'), name: 'cms-courses', icon: 'pi pi-database' },
]);

const adminLinks = computed(() => [
  {
    label: t('sidebar.adminHome'),
    name: 'admin-dashboard',
    icon: 'pi pi-shield',
    groupNames: [
      'admin-dashboard',
      'admin-users',
      'admin-invitations',
      'admin-course-levels',
      'admin-settings',
    ],
  },
  { label: 'Usuarios', name: 'admin-users', icon: 'pi pi-users' },
  { label: 'Invitaciones', name: 'admin-invitations', icon: 'pi pi-envelope' },
  { label: 'Niveles', name: 'admin-course-levels', icon: 'pi pi-graduation-cap' },
  { label: 'Config', name: 'admin-settings', icon: 'pi pi-cog' },
  { label: t('sidebar.cms'), name: 'cms-courses', icon: 'pi pi-database' },
]);

const staffLinks = computed(() => [
  { label: t('sidebar.cms'), name: 'cms-courses', icon: 'pi pi-database' },
]);

const navLinks = computed(() => {
  const links = [];

  const addLinks = (items) => {
    items.forEach((item) => {
      if (!links.some((existing) => existing.name === item.name)) {
        links.push(item);
      }
    });
  };

  if (auth.hasRole && auth.hasRole('admin')) addLinks(adminLinks.value);
  if (auth.hasRole && auth.hasRole('instructor')) addLinks(instructorLinks.value);
  if (auth.hasAnyRole && auth.hasAnyRole(['content_editor', 'enrollment_manager'])) addLinks(staffLinks.value);
  if (auth.hasRole && auth.hasRole('student')) addLinks(studentLinks.value);

  return links;
});

const isActiveGroup = (link) =>
  Array.isArray(link.groupNames) && link.groupNames.includes(String(route.name || ''));

const handleLogout = async () => {
  await auth.logout();
  mobileSidebarOpen.value = false;
  router.push('/login');
};

const toggleSidebar = () => {
  collapsed.value = !collapsed.value;
};

const showSidebar = computed(() => !route.meta?.hideSidebar);

const canShowNotifications = computed(
  () => Boolean(auth.isAuthenticated) && auth.hasRole && auth.hasRole('student'),
);

const unreadBadge = computed(() => {
  const count = Number(notifications.unreadCount || 0);
  if (!count) return '';
  return count > 99 ? '99+' : String(count);
});

const languageToggle = computed({
  get: () => locale.value === 'es',
  set: (value) => {
    const nextLocale = value ? 'es' : 'en';
    locale.value = nextLocale;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('app:locale', nextLocale);
    }
  },
});

const languageLabel = computed(() => (locale.value === 'es' ? 'ES' : 'EN'));

const roleSummary = computed(() =>
  auth.globalRoles?.length ? auth.globalRoles.join(', ') : t('sidebar.noRole'),
);

const initials = computed(() => {
  if (!auth.user?.fullName) return 'AC';
  return auth.user.fullName
    .split(' ')
    .map((chunk) => chunk.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
});

const toggleIcon = computed(() =>
  collapsed.value ? 'pi pi-chevron-right' : 'pi pi-chevron-left',
);

const handleUnreadChange = (count) => {
  notifications.setUnreadCount(count);
};

const handleNotificationsHide = async () => {
  await notifications.refreshUnreadCount();
};

const handleOpenNotificationsFromMobile = () => {
  mobileSidebarOpen.value = false;
  openNotifications.value = true;
};

const PRESENCE_PING_INTERVAL_MS = Math.max(
  30000,
  Number(import.meta.env.VITE_PRESENCE_PING_INTERVAL_MS || 60000),
);

let notificationsRefreshTimer = null;
let presenceRefreshTimer = null;
let presencePingInFlight = false;

const clearNotificationsRefreshTimer = () => {
  if (notificationsRefreshTimer) {
    clearInterval(notificationsRefreshTimer);
    notificationsRefreshTimer = null;
  }
};

const clearPresenceRefreshTimer = () => {
  if (presenceRefreshTimer) {
    clearInterval(presenceRefreshTimer);
    presenceRefreshTimer = null;
  }
};

const sendPresencePing = async () => {
  if (!canShowNotifications.value) return;
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  if (presencePingInFlight) return;

  presencePingInFlight = true;
  try {
    await pingPresence('web');
  } catch (err) {
    // Silent on purpose: presence ping should never break UI.
  } finally {
    presencePingInFlight = false;
  }
};

const refreshUnreadIfStudent = async () => {
  if (!canShowNotifications.value) return;
  await notifications.refreshUnreadCount();
};

const handleVisibilityChange = async () => {
  if (document.visibilityState === 'visible') {
    await refreshUnreadIfStudent();
    await sendPresencePing();
  }
};

watch(openNotifications, (isOpen) => {
  if (isOpen) notificationsPanelKey.value += 1;
});

watch(
  () => route.fullPath,
  () => {
    mobileSidebarOpen.value = false;
  }
);

watch(
  canShowNotifications,
  async (enabled) => {
    clearNotificationsRefreshTimer();
    clearPresenceRefreshTimer();
    if (!enabled) {
      notifications.setUnreadCount(0);
      return;
    }
    await refreshUnreadIfStudent();
    await sendPresencePing();
    notificationsRefreshTimer = setInterval(() => {
      refreshUnreadIfStudent();
    }, 45000);
    presenceRefreshTimer = setInterval(() => {
      sendPresencePing();
    }, PRESENCE_PING_INTERVAL_MS);
  },
  { immediate: true },
);

onMounted(() => {
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
});

onBeforeUnmount(() => {
  clearNotificationsRefreshTimer();
  clearPresenceRefreshTimer();
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }
});

</script>

<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  font-family: 'Poppins', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background:
    radial-gradient(520px 260px at 20% 20%, rgba(59, 130, 246, 0.06), transparent 60%),
    radial-gradient(520px 260px at 80% 30%, rgba(16, 185, 129, 0.06), transparent 60%),
    linear-gradient(180deg, var(--app-bg) 0%, #f8fafc 100%);
}

.mobile-topbar {
  display: none;
}

.sidebar,
.drawer-sidebar {
  background: linear-gradient(180deg, #0f172a 0%, #172033 100%);
  color: #e2e8f0;
}

.sidebar {
  width: 280px;
  min-width: 280px;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  padding: 16px 10px;
  transition: all 0.25s ease;
  display: flex;
  height: 100vh;
  position: sticky;
  top: 0;
  box-shadow: 8px 0 24px rgba(15, 23, 42, 0.10);
  z-index: 20;
}

.sidebar.collapsed {
  width: 82px;
  min-width: 82px;
}

.sidebar-inner,
.drawer-sidebar {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 1rem;
}

.sidebar-inner {
  height: 100%;
  overflow-y: auto;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge antiguo */
}

.sidebar-inner::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.drawer-sidebar {
  min-height: 100%;
  padding: 16px 10px;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.drawer-sidebar::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.drawer-sidebar {
  min-height: 100%;
  padding: 16px 10px;
  overflow-y: auto;
}

.sidebar-header,
.drawer-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 4px 6px 10px;
}

.brand-block {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.brand-avatar {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: #fff;
  width: 2.7rem;
  height: 2.7rem;
  font-size: 1rem;
  box-shadow: 0 8px 18px rgba(59, 130, 246, 0.22);
  flex-shrink: 0;
}

.brand-copy {
  display: grid;
  min-width: 0;
}

.brand-copy strong {
  display: block;
  font-size: 1rem;
  color: #ffffff;
  line-height: 1.1;
}

.brand-copy small {
  color: #94a3b8;
  font-size: 0.75rem;
}

.collapse-btn {
  margin-left: auto;
  color: #94a3b8 !important;
  flex-shrink: 0;
}

.collapse-btn:hover {
  background: rgba(255, 255, 255, 0.06) !important;
  color: #ffffff !important;
}

.sidebar.collapsed .sidebar-header {
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.sidebar.collapsed .brand-block {
  flex-direction: column;
  gap: 0.5rem;
}

.sidebar.collapsed .collapse-btn {
  margin-left: 0;
}

.sidebar-section {
  padding: 0 4px;
}

.section-label {
  display: block;
  color: #94a3b8;
  margin-bottom: 0.5rem;
  padding: 0 8px;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.notifications-trigger {
  position: relative;
  margin-bottom: 0.4rem;
}

.bell-button {
  width: 100%;
}

.sidebar.collapsed .bell-button {
  justify-content: center;
}

.bell-badge {
  position: absolute;
  top: -0.25rem;
  right: -0.15rem;
  min-width: 1.15rem;
  height: 1.15rem;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0 0.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #0f172a;
  box-shadow: 0 4px 10px rgba(239, 68, 68, 0.22);
}

.nav-item {
  width: 100%;
  justify-content: flex-start;
  border-radius: 14px !important;
  font-weight: 600;
  color: #cbd5e1 !important;
  background: transparent !important;
  border: 1px solid transparent !important;
  transition: all 0.18s ease;
  min-height: 46px;
  padding-inline: 0.9rem !important;
  position: relative;
  box-shadow: none !important;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.04) !important;
  border-color: rgba(255, 255, 255, 0.04) !important;
  color: #ffffff !important;
}

.nav-item-active {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #ffffff !important;
  border-color: rgba(255, 255, 255, 0.06) !important;
}

.nav-item-active::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 999px;
  background: #60a5fa;
}

.sidebar.collapsed .nav-item {
  justify-content: center;
  align-items: center;
  width: 48px;
  min-width: 48px;
  height: 48px;
  min-height: 48px;
  padding: 0 !important;
  margin: 0 auto;
  border-radius: 999px !important;
}

.sidebar.collapsed .nav-item-active {
  background: rgba(255, 255, 255, 0.10) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  box-shadow: none !important;
}

.sidebar.collapsed .nav-item-active::before {
  display: none;
}

.language-switch {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0 0.75rem;
  color: #94a3b8;
}

.sidebar.collapsed .language-switch {
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0;
}

.language-switch i {
  font-size: 0.95rem;
  opacity: 0.8;
}

.sidebar.collapsed .language-switch :deep(.p-inputswitch) {
  transform: scale(0.85);
}

.sidebar.collapsed .language-label {
  display: none;
}

.language-switch .language-label {
  font-size: 0.85rem;
  color: #cbd5e1;
}

.language-switch-mobile {
  padding-inline: 0.35rem;
}

.sidebar-divider {
  margin: 0.25rem 0 !important;
  opacity: 0.2;
}

.spacer {
  flex: 1;
}

.user-card {
  padding: 0.9rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;
}

.user-card:hover {
  background: rgba(255, 255, 255, 0.06);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.user-avatar {
  background: linear-gradient(135deg, #1d4ed8, #3b82f6);
  color: #ffffff;
  flex-shrink: 0;
}

.container-user-info {
  display: grid;
  min-width: 0;
}

.container-user-info strong {
  color: #ffffff;
  font-size: 0.92rem;
  line-height: 1.1;
}

.container-user-info small {
  color: #94a3b8;
  font-size: 0.72rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: space-between;
}

.logout-btn {
  color: #cbd5e1 !important;
}

.logout-btn:hover {
  background: rgba(255, 255, 255, 0.06) !important;
  color: #ffffff !important;
}

.sidebar.collapsed .user-card {
  padding: 0.7rem 0.35rem;
}

.sidebar.collapsed .user-info {
  justify-content: center;
  margin-bottom: 0;
}

.shell-content {
  flex: 1;
  background: transparent;
  max-width: 100%;
  min-width: 0;
}

.mobile-drawer :deep(.p-sidebar) {
  width: min(320px, 86vw);
  padding: 0;
  background: transparent;
  box-shadow: none;
}

.mobile-drawer :deep(.p-sidebar-header) {
  display: none;
}

.mobile-drawer :deep(.p-sidebar-content) {
  padding: 0;
}

@media (max-width: 1024px) {
  .sidebar {
    width: 240px;
    min-width: 240px;
  }

  .sidebar.collapsed {
    width: 74px;
    min-width: 74px;
  }
}

@media (max-width: 768px) {
  .shell {
    flex-direction: column;
  }

  .desktop-sidebar {
    display: none !important;
  }

  .mobile-topbar {
    display: flex !important;
    align-items: center;
    gap: 0.85rem;
    position: sticky;
    top: 0;
    z-index: 30;
    padding: 0.85rem 1rem;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  }

  .mobile-menu-btn {
    color: #0f172a !important;
  }

 .mobile-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  flex: 1;
}

.mobile-brand-avatar {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: #fff;
  flex-shrink: 0;
}

.mobile-brand-copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  overflow: hidden;
}

.mobile-brand-copy strong {
  font-size: 1rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-brand-copy small {
  color: #64748b;
  font-size: 0.72rem;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mobile-topbar {
  display: flex !important;
  align-items: center;
  gap: 0.85rem;
  position: sticky;
  top: 0;
  z-index: 30;
  padding: 0.85rem 1rem;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

}
</style>
