<template>
  <div class="shell">
    <!-- MOBILE TOPBAR -->
    <header v-if="showSidebar" class="mobile-topbar">
      <div class="mobile-brand">
        <Avatar label="AC" shape="circle" class="mobile-brand-avatar" />
        <div class="mobile-brand-copy">
          <strong>{{ t('common.brandTitle') }}</strong>
          <small>{{ t('common.brandSubtitle') }}</small>
        </div>
      </div>

      <Button
        icon="pi pi-bars"
        class="p-button-rounded p-button-text mobile-menu-btn"
        :aria-label="t('sidebar.toggle')"
        @click="mobileSidebarOpen = true"
      />
    </header>

    <!-- DESKTOP SIDEBAR -->
    <aside
      v-if="showSidebar"
      :class="['sidebar', 'desktop-sidebar', { collapsed }]"
    >
      <div class="sidebar-inner">
        <div class="sidebar-header">
          <Button
            :icon="toggleIcon"
            class="p-button-rounded p-button-text collapse-btn sidebar-top-toggle"
            @click="toggleSidebar"
            :aria-label="t('sidebar.toggle')"
          />

          <div class="brand-block">
            <Avatar label="AC" shape="circle" size="large" class="brand-avatar" />
            <div class="brand-copy" v-if="!collapsed">
              <strong>{{ t('common.brandTitle') }}</strong>
              <small>{{ t('common.brandSubtitle') }}</small>
            </div>
          </div>

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
              :title="collapsed ? 'Notificaciones' : undefined"
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
                :title="collapsed ? link.label : undefined"
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
      position="right"
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
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('app:sidebar:collapsed', collapsed.value ? '1' : '0');
  }
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

const toggleIcon = computed(() => (collapsed.value ? 'pi pi-bars' : 'pi pi-times'));

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
  if (typeof window !== 'undefined') {
    const storedCollapsed = window.localStorage.getItem('app:sidebar:collapsed');
    if (storedCollapsed !== null) {
      collapsed.value = storedCollapsed === '1';
    }
  }

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
