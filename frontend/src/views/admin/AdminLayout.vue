<template>
  <div class="page admin-layout-page">
    <main class="admin-layout-main">
      <header class="admin-layout-header">
        <div class="admin-layout-header__content">
          <p class="admin-layout-eyebrow">Academy</p>
          <h1>Admin Panel</h1>
          <p class="admin-layout-description">
            Gestiona usuarios, invitaciones, niveles y configuración general de la plataforma.
          </p>
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

      <section class="admin-layout-content">
        <RouterView />
      </section>
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
  { name: 'admin-images', label: 'Imágenes', icon: 'pi pi-images' },
  { name: 'admin-settings', label: 'Configuración', icon: 'pi pi-cog' },
];
</script>

<style scoped>
.admin-layout-page,
.admin-layout-page * {
  box-sizing: border-box;
}

.admin-layout-page {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: hidden;
}

.admin-layout-main {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  margin: 0;
  padding: var(--page-padding);
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  overflow-x: hidden;
}

/* HEADER */
.admin-layout-header {
  width: 100%;
  min-width: 0;
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-lg);
  padding: 1rem 1.15rem;
  background: linear-gradient(135deg, var(--app-surface) 0%, var(--app-surface-2) 100%);
  border: 1px solid var(--app-border);
  box-shadow: var(--shadow-sm);
}

.admin-layout-header__content {
  position: relative;
  z-index: 1;
  max-width: 760px;
  min-width: 0;
}

.admin-layout-header h1 {
  margin: 0;
  font-size: clamp(1.35rem, 2vw, 1.7rem);
  line-height: 1.08;
  font-weight: 700;
  color: var(--text-primary);
  word-break: break-word;
}

.admin-layout-eyebrow {
  margin: 0 0 0.45rem;
  text-transform: uppercase;
  font-size: 0.72rem;
  letter-spacing: 0.16rem;
  font-weight: 700;
  color: var(--brand-primary);
}

.admin-layout-description {
  margin: 0.5rem 0 0;
  max-width: 620px;
  font-size: 0.9rem;
  line-height: 1.45;
  color: var(--text-muted);
}

/* SUBNAV */
.admin-subnav {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0.35rem;
  border: 1px solid var(--app-border);
  border-radius: var(--radius-lg);
  background: var(--app-surface);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.admin-subnav__item {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: var(--control-height);
  border-radius: var(--radius-sm);
  padding: 0.48rem 0.75rem;
  font-size: 0.88rem;
  font-weight: 650;
  color: var(--text-secondary);
  text-decoration: none;
  border: 1px solid transparent;
  white-space: nowrap;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.admin-subnav__item i {
  font-size: 0.9rem;
  flex-shrink: 0;
}

.admin-subnav__item span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-subnav__item:hover {
  background: var(--app-surface-2);
  color: var(--text-primary);
}

.admin-subnav__item.active {
  color: var(--brand-primary);
  background: var(--brand-primary-soft);
  border-color: rgba(18, 53, 91, 0.2);
  box-shadow: none;
}

/* CONTENT */
.admin-layout-content {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: hidden;
}

/* TABLET */
@media (max-width: 1024px) {
  .admin-layout-main {
    padding: 0.9rem;
  }

  .admin-layout-header {
    padding: 0.95rem;
    border-radius: var(--radius-lg);
  }

  .admin-layout-description {
    font-size: 0.92rem;
  }
}

/* MOBILE */
@media (max-width: 768px) {
  .admin-layout-page {
    padding: 0;
    margin: 0;
  }

  .admin-layout-main {
    padding: 0;
    gap: 0.85rem;
  }

  .admin-layout-header,
  .admin-subnav,
  .admin-layout-content {
    width: 100%;
    max-width: 100%;
    margin: 0;
  }

  .admin-layout-header,
  .admin-subnav {
    border-radius: 0;
  }

  .admin-layout-header {
    padding: 1rem 0.95rem;
  }

  .admin-layout-header h1 {
    font-size: 1.35rem;
  }

  .admin-layout-eyebrow {
    font-size: 0.7rem;
    letter-spacing: 0.18rem;
  }

  .admin-layout-description {
    font-size: 0.88rem;
    line-height: 1.5;
  }

  .admin-subnav {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.45rem;
    padding: 0.65rem 0.95rem;
    overflow: visible;
  }

  .admin-subnav__item {
    width: 100%;
    min-width: 0;
    justify-content: flex-start;
    padding: 0.62rem 0.75rem;
    white-space: normal;
  }

  .admin-subnav__item span {
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .admin-layout-content {
    padding: 0 0.95rem 1rem;
  }
}

/* VERY SMALL MOBILE */
@media (max-width: 480px) {
  .admin-layout-header {
    padding: 0.95rem 0.85rem;
  }

  .admin-layout-header h1 {
    font-size: 1.22rem;
  }

  .admin-layout-description {
    font-size: 0.84rem;
    margin-top: 0.55rem;
  }

  .admin-subnav {
    grid-template-columns: 1fr;
    padding: 0.7rem 0.85rem;
  }

  .admin-subnav__item {
    min-height: var(--control-height);
    font-size: 0.86rem;
    padding: 0.58rem 0.7rem;
  }

  .admin-layout-content {
    padding: 0 0.85rem 0.95rem;
  }
}
</style>
