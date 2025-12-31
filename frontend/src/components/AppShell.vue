<template>
  <div class="shell">
    <aside :class="['sidebar', { collapsed }]">
      <div class="sidebar-inner">
        <div class="sidebar-header">
          <Avatar label="AC" shape="circle" size="large" class="brand-avatar" />
          <div class="brand-copy" v-if="!collapsed">
            <strong>Academy</strong>
            <small>Learning</small>
          </div>
          <Button
            :icon="toggleIcon"
            class="p-button-rounded p-button-text collapse-btn"
            @click="toggleSidebar"
            aria-label="Toggle sidebar"
          />
        </div>

        <!-- <div class="sidebar-search" v-if="!collapsed">
          <span class="p-input-icon-left">
            <i class="pi pi-search" />
            <InputText placeholder="Search" />
          </span>
        </div> -->

        <div class="sidebar-section">
          <small v-if="!collapsed">Workspace</small>
          <div class="nav-list">
            <Button
              v-for="link in navLinks"
              :key="link.to"
              class="nav-item"
              :label="collapsed ? '' : link.label"
              :icon="link.icon"
              :severity="isActive(link.to) ? 'primary' : null"
              :outlined="!isActive(link.to)"
              @click="navigate(link.to)"
              :aria-label="link.label"
            />
          </div>
        </div>

        <Divider />

        <!-- <div class="sidebar-section" v-if="!collapsed">
          <small>Projects</small>
          <div class="project-dots">
            <span class="dot dot-green"></span>
            <span class="dot dot-blue"></span>
            <span class="dot dot-purple"></span>
          </div>
        </div> -->

        <div class="spacer" />

        <div class="user-card">
          <div class="user-info">
            <Avatar :label="initials" shape="circle" />
            <div class="container-user-info" v-if="!collapsed">
              <strong>{{ auth.user?.fullName }}</strong>
              <small>{{ auth.user?.email }}</small>
            </div>
          </div>
          <div class="user-actions">
            <Tag :value="roleSummary" severity="info" size="small" v-if="!collapsed" />
            <Button
              v-if="!collapsed"
              icon="pi pi-sign-out"
              class="p-button-rounded p-button-text"
              label="Logout"
              @click="handleLogout"
            />
          </div>
        </div>
      </div>
    </aside>

    <main class="shell-content">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const collapsed = ref(false);

const studentLinks = [{ label: 'Student Dashboard', to: '/student', icon: 'pi pi-home' }];

const instructorLinks = [
  { label: 'Instructor Dashboard', to: '/instructor', icon: 'pi pi-users' },
  { label: 'CMS', to: '/cms/courses', icon: 'pi pi-database' },
];

const adminLinks = [
  { label: 'Admin Home', to: '/admin', icon: 'pi pi-shield' },
  { label: 'CMS', to: '/cms/courses', icon: 'pi pi-database' },
];

const staffLinks = [{ label: 'CMS', to: '/cms/courses', icon: 'pi pi-database' }];

const navLinks = computed(() => {
  const links = [];
  const addLinks = (items) => {
    items.forEach((item) => {
      if (!links.some((existing) => existing.to === item.to)) {
        links.push(item);
      }
    });
  };

  if (auth.hasRole && auth.hasRole('admin')) {
    addLinks(adminLinks);
  }
  if (auth.hasRole && auth.hasRole('instructor')) {
    addLinks(instructorLinks);
  }
  if (auth.hasAnyRole && auth.hasAnyRole(['content_editor', 'enrollment_manager'])) {
    addLinks(staffLinks);
  }
  if (auth.hasRole && auth.hasRole('student')) {
    addLinks(studentLinks);
  }

  return links;
});

const navigate = (path) => {
  if (route.path !== path) {
    router.push(path);
  }
};

const isActive = (path) => route.path.startsWith(path);

const handleLogout = async () => {
  await auth.logout();
  router.push('/login');
};

const toggleSidebar = () => {
  collapsed.value = !collapsed.value;
};

const roleSummary = computed(() =>
  auth.globalRoles?.length ? auth.globalRoles.join(', ') : 'No role',
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
</script>

<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  background-color: var(--app-bg);
}

.sidebar {
  width: 280px;
  background: var(--app-surface);
  border-right: 1px solid var(--app-border);
  padding: 20px 5px;
  transition: width 0.2s ease;
  display: flex;
  height: 100vh;
  position: sticky;
  top: 0;
}

.sidebar.collapsed {
  width: 52px;
}

.sidebar-inner {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 1rem;
  height: 100%;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.brand-avatar {
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-primary-hover));
  color: #fff;
  width: 2.5rem;
  height: 2.5rem;
  font-size: 1rem;
}

.brand-copy strong {
  display: block;
  font-size: 1rem;
}

.brand-copy small {
  color: var(--text-muted);
}

.collapse-btn {
  margin-left: auto;
  color: var(--text-muted);
  order: 3;
}

.sidebar.collapsed .sidebar-header {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

.sidebar.collapsed .collapse-btn {
  order: -1;
  margin-left: 0;
}

.sidebar-search .p-input-icon-left {
  width: 100%;
}

.sidebar-search input {
  width: 100%;
  border-radius: 999px;
}

.sidebar-section small {
  display: block;
  color: var(--text-muted);
  margin-bottom: 0.35rem;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-item {
  width: 100%;
  justify-content: flex-start;
  border-radius: 0.75rem;
  font-weight: 600; 
}

.sidebar.collapsed .nav-item {
  justify-content: center;
  border-radius: 1rem;
  padding: 0.5rem 0.5rem;
  min-height: 38px;
}

.project-dots {
  display: flex;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.dot {
  width: 14px;
  height: 14px;
  border-radius: 999px;
}

.dot-green {
  background: #a7f3d0;
}

.dot-blue {
  background: #bfdbfe;
}

.dot-purple {
  background: #ddd6fe;
}

.spacer {
  flex: 1;
}

.user-card {
  padding: 1rem;
  border-radius: 1rem;
  background: var(--brand-primary-soft);
  color: var(--text-primary);
  position: sticky;
  bottom: 1rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.sidebar.collapsed .user-card {
  padding: 10px 0px;
}

.sidebar.collapsed .user-info {
  justify-content: center;
}

.user-info small {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.container-user-info{
  display: grid;
}

.container-user-info:nth-child(2){
  overflow-x: hidden;
}

.user-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: space-between;
}

.sidebar.collapsed .user-actions {
  justify-content: center;
}

.shell-content {
  flex: 1;
  padding: 2rem;
  background: var(--app-bg);
}
</style>
