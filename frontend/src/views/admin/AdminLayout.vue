<template>
  <div class="page admin-layout-page">
    <main class="admin-layout-main">
      <header class="admin-layout-header">
        <div>
          <p class="admin-layout-eyebrow">Academy</p>
          <h1>Admin Panel</h1>
        </div>
      </header>

      <nav class="admin-subnav" aria-label="Admin sections">
        <RouterLink
          v-for="item in adminSections"
          :key="item.name"
          :to="{ name: item.name }"
          class="admin-subnav__item"
          :class="{ active: route.name === item.name }"
        >
          <i :class="item.icon" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router';

const route = useRoute();

const adminSections = [
  { name: 'admin-dashboard', label: 'Dashboard', icon: 'pi pi-th-large' },
  { name: 'admin-users', label: 'Usuarios', icon: 'pi pi-users' },
  { name: 'admin-invitations', label: 'Invitaciones', icon: 'pi pi-envelope' },
  { name: 'admin-course-levels', label: 'Niveles', icon: 'pi pi-graduation-cap' },
  { name: 'admin-settings', label: 'Configuración', icon: 'pi pi-cog' },
];
</script>

<style scoped>
.admin-layout-main {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: clamp(1.25rem, 2.5vw, 2.25rem) clamp(1rem, 2vw, 2rem) 3rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.admin-layout-header h1 {
  margin: 0;
  font-size: clamp(1.6rem, 3vw, 2.1rem);
}

.admin-layout-eyebrow {
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.35rem;
  margin: 0;
  color: var(--text-secondary);
}

.admin-subnav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.35rem;
  border: 1px solid var(--app-border);
  border-radius: 14px;
  background: #fff;
  box-shadow: var(--shadow-sm);
}

.admin-subnav__item {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border-radius: 10px;
  padding: 0.55rem 0.8rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #475569;
  text-decoration: none;
  border: 1px solid transparent;
  transition: all 0.16s ease;
}

.admin-subnav__item:hover {
  background: #f8fafc;
}

.admin-subnav__item.active {
  color: #1d4ed8;
  background: #eff6ff;
  border-color: rgba(37, 99, 235, 0.3);
}

@media (max-width: 900px) {
  .admin-layout-main {
    padding: 1rem;
  }
}
</style>
