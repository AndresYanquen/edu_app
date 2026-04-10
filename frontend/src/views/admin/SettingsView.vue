<template>
  <section class="admin-settings-view">
    <Card class="card settings-card">
      <template #title>
        <div class="card-title">
          <h2>Configuración</h2>
          <p>Opciones administrativas y de seguridad.</p>
        </div>
      </template>

      <template #content>
        <div class="settings-grid">
          <article class="settings-item">
            <div class="settings-item__icon">
              <i class="pi pi-palette" />
            </div>
            <div class="settings-item__content">
              <h3>Configuración general</h3>
              <p class="muted">Ajustes de branding y parámetros globales del LMS.</p>
            </div>
          </article>

          <article class="settings-item">
            <div class="settings-item__icon">
              <i class="pi pi-bell" />
            </div>
            <div class="settings-item__content">
              <h3>Notificaciones</h3>
              <p class="muted">Preferencias de alertas administrativas y reportes.</p>
            </div>
          </article>

          <article class="settings-item">
            <div class="settings-item__icon">
              <i class="pi pi-shield" />
            </div>
            <div class="settings-item__content">
              <h3>Opciones globales</h3>
              <p class="muted">Políticas de seguridad y comportamiento por defecto.</p>
            </div>
          </article>
        </div>
      </template>
    </Card>
  </section>
</template>

<script setup>
</script>

<style scoped>
.admin-settings-view,
.admin-settings-view * {
  box-sizing: border-box;
  min-width: 0;
}

.admin-settings-view {
  width: 100%;
  display: grid;
  gap: 1rem;
}

.card {
  width: 100%;
  background: #fff;
  border-radius: 22px;
  border: 1px solid var(--app-border);
  box-shadow: var(--shadow-sm);
  padding: 1.2rem 1.4rem;
  overflow: hidden;
}

.card-title {
  min-width: 0;
}

.card-title h2 {
  margin: 0;
  font-size: 1.4rem;
  line-height: 1.1;
  color: #1e3a5f;
}

.card-title p,
.muted {
  color: var(--text-secondary);
  line-height: 1.5;
}

.card-title p {
  margin: 0.35rem 0 0;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.settings-item {
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
  border: 1px solid var(--app-border);
  border-radius: 16px;
  padding: 1rem;
  background: #f8fafc;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.settings-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
  border-color: rgba(59, 130, 246, 0.18);
}

.settings-item__icon {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 14px;
  background: #dbeafe;
  color: #2563eb;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.settings-item__content {
  min-width: 0;
}

.settings-item h3 {
  margin: 0 0 0.35rem;
  font-size: 1rem;
  line-height: 1.25;
  color: #0f172a;
}

.settings-item p {
  margin: 0;
  font-size: 0.92rem;
  word-break: break-word;
}

@media (max-width: 1024px) {
  .settings-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .card {
    padding: 1rem;
    border-radius: 18px;
  }
}

@media (max-width: 640px) {
  .admin-settings-view {
    gap: 0.9rem;
  }

  .card {
    padding: 0.9rem;
    border-radius: 16px;
  }

  .card-title h2 {
    font-size: 1.2rem;
  }

  .card-title p {
    font-size: 0.92rem;
  }

  .settings-grid {
    grid-template-columns: 1fr;
    gap: 0.85rem;
  }

  .settings-item {
    padding: 0.9rem;
    border-radius: 14px;
  }

  .settings-item__icon {
    width: 2.55rem;
    height: 2.55rem;
    border-radius: 12px;
  }

  .settings-item h3 {
    font-size: 0.98rem;
  }

  .settings-item p {
    font-size: 0.9rem;
  }
}
</style>