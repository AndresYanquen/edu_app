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
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-x: hidden;
}

/* HEADER */
.admin-layout-header {
  width: 100%;
  min-width: 0;
  position: relative;
  overflow: hidden;
  border-radius: 22px;
  padding: 1.25rem;
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.14), transparent 30%),
    linear-gradient(135deg, #ffffff 0%, #f8fbff 100%);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.05);
}

.admin-layout-header__content {
  position: relative;
  z-index: 1;
  max-width: 760px;
  min-width: 0;
}

.admin-layout-header h1 {
  margin: 0;
  font-size: clamp(1.55rem, 2.8vw, 2.2rem);
  line-height: 1.08;
  font-weight: 800;
  color: #0f172a;
  word-break: break-word;
}

.admin-layout-eyebrow {
  margin: 0 0 0.45rem;
  text-transform: uppercase;
  font-size: 0.76rem;
  letter-spacing: 0.24rem;
  font-weight: 700;
  color: #2563eb;
}

.admin-layout-description {
  margin: 0.7rem 0 0;
  max-width: 620px;
  font-size: 0.95rem;
  line-height: 1.6;
  color: #64748b;
}

/* SUBNAV */
.admin-subnav {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  padding: 0.45rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
  overflow: hidden;
}

.admin-subnav__item {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  min-height: 44px;
  border-radius: 12px;
  padding: 0.72rem 1rem;
  font-size: 0.92rem;
  font-weight: 700;
  color: #475569;
  text-decoration: none;
  border: 1px solid transparent;
  white-space: nowrap;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.admin-subnav__item i {
  font-size: 0.95rem;
  flex-shrink: 0;
}

.admin-subnav__item span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-subnav__item:hover {
  background: #f8fafc;
  color: #0f172a;
  transform: translateY(-1px);
}

.admin-subnav__item.active {
  color: #1d4ed8;
  background: linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%);
  border-color: rgba(37, 99, 235, 0.22);
  box-shadow: 0 8px 16px rgba(37, 99, 235, 0.1);
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
    padding: 0.95rem;
  }

  .admin-layout-header {
    padding: 1.1rem;
    border-radius: 20px;
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
    gap: 0.55rem;
    padding: 0.75rem 0.95rem;
    overflow: visible;
  }

  .admin-subnav__item {
    width: 100%;
    min-width: 0;
    justify-content: flex-start;
    padding: 0.75rem 0.85rem;
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
    min-height: 42px;
    font-size: 0.88rem;
    padding: 0.7rem 0.85rem;
  }

  .admin-layout-content {
    padding: 0 0.85rem 0.95rem;
  }
}
</style>
