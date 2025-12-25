<template>
  <div class="shell">
    <Toolbar class="topbar">
      <template #start>
        <div class="brand">
          <i class="pi pi-graduation-cap"></i>
          <div>
            <h3>Academy</h3>
            <small>MVP</small>
          </div>
        </div>
      </template>
      <template #center>
        <div class="nav-links" v-if="navLinks.length">
          <Button
            v-for="link in navLinks"
            :key="link.to"
            class="p-button-text"
            :label="link.label"
            :icon="link.icon"
            @click="navigate(link.to)"
            :severity="isActive(link.to) ? 'info' : null"
          />
        </div>
      </template>
      <template #end>
        <div class="user-meta">
          <span class="user-name">{{ auth.user?.fullName }}</span>
          <Tag :value="auth.role" severity="info" />
          <Button
            label="Logout"
            icon="pi pi-sign-out"
            class="p-button-rounded p-button-text"
            @click="handleLogout"
          />
        </div>
      </template>
    </Toolbar>

    <div class="shell-body">
      <div class="shell-content">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const studentLinks = [
  { label: 'Student Dashboard', to: '/student', icon: 'pi pi-home' },
];

const instructorLinks = [
  { label: 'Instructor Dashboard', to: '/instructor', icon: 'pi pi-users' },
];

const adminLinks = [
  { label: 'Admin Home', to: '/admin', icon: 'pi pi-shield' },
];

const navLinks = computed(() => {
  if (auth.role === 'student') return studentLinks;
  if (auth.role === 'instructor') return instructorLinks;
  if (auth.role === 'admin') return adminLinks;
  return [];
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
</script>

<style scoped>
.shell {
  min-height: 100vh;
  background-color: #f4f5f7;
}

.topbar {
  background-color: #0f172a;
  color: #fff;
  padding: 0 1.5rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1rem;
}

.brand i {
  font-size: 1.5rem;
}

.brand h3 {
  margin: 0;
  font-size: 1rem;
}

.brand small {
  color: #cbd5f5;
}

.nav-links {
  display: flex;
  gap: 0.5rem;
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-name {
  font-weight: 600;
}

.shell-body {
  padding: 1.5rem;
}

.shell-content {
  min-height: calc(100vh - 4rem);
}

@media (max-width: 768px) {
  .topbar {
    flex-wrap: wrap;
    gap: 1rem;
  }

  .nav-links {
    flex-wrap: wrap;
    justify-content: center;
  }

  .user-meta {
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>
