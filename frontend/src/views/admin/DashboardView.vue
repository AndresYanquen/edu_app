<template>
  <section class="admin-dashboard">
    <div class="dashboard-topbar">
      <div />
    </div>

    <section class="kpi-grid">
      <article class="kpi-card">
        <span class="kpi-icon users"><i class="pi pi-users" /></span>
        <div>
          <p>Total usuarios</p>
          <strong>{{ totalUsers }}</strong>
        </div>
      </article>
      <article class="kpi-card">
        <span class="kpi-icon active"><i class="pi pi-user-plus" /></span>
        <div>
          <p>Usuarios activos</p>
          <strong>{{ activeUsers }}</strong>
        </div>
      </article>
      <article class="kpi-card">
        <span class="kpi-icon courses"><i class="pi pi-graduation-cap" /></span>
        <div>
          <p>Cursos activos</p>
          <strong>{{ totalCourses }}</strong>
        </div>
      </article>
      <article class="kpi-card">
        <span class="kpi-icon alerts"><i class="pi pi-bell" /></span>
        <div>
          <p>Alertas</p>
          <strong>{{ alertCount }}</strong>
        </div>
      </article>
    </section>

    <Card class="dashboard-card">
      <template #title>
        <h2>Acciones rápidas</h2>
      </template>
      <template #content>
        <div class="quick-grid">
          <button
            v-for="item in quickActions"
            :key="item.label"
            type="button"
            class="quick-item"
            @click="router.push({ name: item.routeName })"
          >
            <span class="quick-item__icon"><i :class="item.icon" /></span>
            <span class="quick-item__label">{{ item.label }}</span>
          </button>
        </div>
      </template>
    </Card>

    <div class="dashboard-split">
      <Card class="dashboard-card">
        <template #title>
          <h2>Alertas</h2>
        </template>
        <template #content>
          <div class="alert-list" v-if="alerts.length">
            <div v-for="alert in alerts" :key="alert.id" class="alert-row">
              <Tag :value="alert.level" :severity="alert.severity" />
              <span>{{ alert.message }}</span>
            </div>
          </div>
          <p v-else class="muted">Sin alertas relevantes por ahora.</p>
        </template>
      </Card>

      <Card class="dashboard-card">
        <template #title>
          <h2>Actividad reciente</h2>
        </template>
        <template #content>
          <div v-if="loadingRecent">
            <Skeleton height="2rem" class="mb-2" />
            <Skeleton height="2rem" class="mb-2" />
            <Skeleton height="2rem" />
          </div>
          <div v-else-if="recentUsers.length" class="recent-list">
            <div v-for="user in recentUsers" :key="user.id" class="recent-row">
              <span class="recent-avatar">{{ initials(user.full_name) }}</span>
              <div>
                <strong>{{ user.full_name }}</strong>
                <small>{{ user.email }}</small>
              </div>
            </div>
          </div>
          <p v-else class="muted">No hay actividad reciente.</p>
        </template>
      </Card>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { listCourses } from '../../api/cms';
import { listCourseLevels, listUsers } from '../../api/admin';

const router = useRouter();

const totalUsers = ref(0);
const activeUsers = ref(0);
const totalCourses = ref(0);
const inactiveLevels = ref(0);
const pendingUsers = ref(0);
const loadingRecent = ref(false);
const recentUsers = ref([]);

const quickActions = [
  { label: 'Usuarios', icon: 'pi pi-users', routeName: 'admin-users' },
  { label: 'Invitación masiva', icon: 'pi pi-envelope', routeName: 'admin-invitations' },
  { label: 'Niveles de curso', icon: 'pi pi-graduation-cap', routeName: 'admin-course-levels' },
  { label: 'Configuración', icon: 'pi pi-cog', routeName: 'admin-settings' },
];

const alertCount = computed(() => Number(inactiveLevels.value) + Number(pendingUsers.value));

const alerts = computed(() => {
  const rows = [];
  if (inactiveLevels.value > 0) {
    rows.push({
      id: 'inactive-levels',
      level: 'Niveles',
      severity: 'warning',
      message: `${inactiveLevels.value} niveles inactivos detectados`,
    });
  }
  if (pendingUsers.value > 0) {
    rows.push({
      id: 'pending-users',
      level: 'Usuarios',
      severity: 'info',
      message: `${pendingUsers.value} usuarios pendientes de activación`,
    });
  }
  return rows;
});

const initials = (name = '') =>
  String(name || '')
    .split(' ')
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

const loadDashboardData = async () => {
  loadingRecent.value = true;
  try {
    const [usersResponse, coursesResponse, levelsResponse] = await Promise.all([
      listUsers({ page: 1, pageSize: 1000 }),
      listCourses(),
      listCourseLevels(),
    ]);

    const userRows = Array.isArray(usersResponse?.users)
      ? usersResponse.users
      : Array.isArray(usersResponse)
      ? usersResponse
      : [];

    totalUsers.value = Number(usersResponse?.total || userRows.length);
    activeUsers.value = userRows.filter((user) => user?.is_active).length;
    pendingUsers.value = userRows.filter((user) => user?.must_set_password).length;
    recentUsers.value = userRows.slice(0, 5);

    totalCourses.value = Array.isArray(coursesResponse) ? coursesResponse.length : 0;
    inactiveLevels.value = Array.isArray(levelsResponse)
      ? levelsResponse.filter((level) => !level?.is_active).length
      : 0;
  } finally {
    loadingRecent.value = false;
  }
};

onMounted(() => {
  loadDashboardData();
});
</script>

<style scoped>
.admin-dashboard {
  display: grid;
  gap: 1rem;
}

.dashboard-topbar {
  display: flex;
  justify-content: space-between;
}

.dashboard-create-btn {
  border-radius: 12px;
  padding-inline: 1.1rem;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

.kpi-card {
  background: #fff;
  border: 1px solid var(--app-border);
  border-radius: 18px;
  box-shadow: var(--shadow-sm);
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.kpi-card p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.92rem;
}

.kpi-card strong {
  font-size: 2rem;
  line-height: 1;
}

.kpi-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}

.kpi-icon.users { background: #dbeafe; color: #2563eb; }
.kpi-icon.active { background: #d1fae5; color: #059669; }
.kpi-icon.courses { background: #e0e7ff; color: #4338ca; }
.kpi-icon.alerts { background: #fee2e2; color: #dc2626; }

.dashboard-card {
  background: #fff;
  border: 1px solid var(--app-border);
  border-radius: 22px;
  box-shadow: var(--shadow-sm);
}

.dashboard-card h2 {
  margin: 0;
  font-size: 1.5rem;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.quick-item {
  border: 1px solid var(--app-border);
  border-radius: 16px;
  background: #f8fafc;
  padding: 0.95rem;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  cursor: pointer;
  text-align: left;
}

.quick-item__icon {
  width: 2.3rem;
  height: 2.3rem;
  border-radius: 10px;
  background: #dbeafe;
  color: #1d4ed8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.quick-item__label {
  font-weight: 600;
  color: #0f172a;
}

.dashboard-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.alert-list,
.recent-list {
  display: grid;
  gap: 0.6rem;
}

.alert-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.55rem 0.65rem;
  border-radius: 12px;
  background: #f8fafc;
}

.recent-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
}

.recent-row small,
.muted {
  color: #64748b;
}

.recent-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  background: rgba(13, 59, 102, 0.16);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

@media (max-width: 1000px) {
  .kpi-grid,
  .quick-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-split {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .kpi-grid,
  .quick-grid {
    grid-template-columns: 1fr;
  }

  .dashboard-create-btn {
    width: 100%;
  }
}
</style>
