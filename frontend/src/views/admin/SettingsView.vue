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
            <h3>Configuración general</h3>
            <p class="muted">Ajustes de branding y parámetros globales del LMS.</p>
          </article>
          <article class="settings-item">
            <h3>Notificaciones</h3>
            <p class="muted">Preferencias de alertas administrativas y reportes.</p>
          </article>
          <article class="settings-item">
            <h3>Opciones globales</h3>
            <p class="muted">Políticas de seguridad y comportamiento por defecto.</p>
          </article>
        </div>
      </template>
    </Card>
  </section>
</template>

<script setup>
</script>

<style scoped>
.admin-settings-view {
  display: grid;
}

.card {
  background: #fff;
  border-radius: 22px;
  border: 1px solid var(--app-border);
  box-shadow: var(--shadow-sm);
  padding: 1.2rem 1.4rem;
}

.card-title h2 {
  margin: 0;
  font-size: 1.4rem;
}

.card-title p,
.muted {
  color: var(--text-secondary);
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.8rem;
}

.settings-item {
  border: 1px solid var(--app-border);
  border-radius: 14px;
  padding: 0.9rem;
  background: #f8fafc;
}

.settings-item h3 {
  margin: 0 0 0.4rem;
  font-size: 1rem;
}

.settings-item p {
  margin: 0;
  font-size: 0.9rem;
}
</style>
