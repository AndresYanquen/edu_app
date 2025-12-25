<template>
  <div class="page">
    <Card>
      <template #title>
        <div class="header">
          <div>
            <h2>{{ group?.name || 'Group' }}</h2>
            <p>{{ group?.schedule_text }}</p>
          </div>
          <Button label="Back" icon="pi pi-arrow-left" class="p-button-text" @click="goBack" />
        </div>
      </template>

      <template #content>
        <div v-if="loading">
          <Skeleton height="3rem" class="mb-2" />
          <Skeleton height="3rem" class="mb-2" />
          <Skeleton height="3rem" class="mb-2" />
        </div>

        <div v-else-if="error">
          <p>Failed to load group.</p>
          <Button label="Reload" icon="pi pi-refresh" class="p-button-text" @click="loadData" />
        </div>

        <div v-else>
          <div class="summary">
            <div>
              <small>Total students</small>
              <strong>{{ totalStudents }}</strong>
            </div>
            <div>
              <small>Average progress</small>
              <strong>{{ averagePercent }}%</strong>
            </div>
          </div>

          <div class="table-controls">
            <span class="control-label">Filter</span>
            <InputText v-model="filter" placeholder="Search students" />
            <Button label="Reload" icon="pi pi-refresh" class="p-button-text" @click="loadData" />
          </div>

          <template v-if="students.length">
            <DataTable
              :value="filteredStudents"
              responsiveLayout="scroll"
              paginator
              :rows="10"
              :rowsPerPageOptions="[10, 25, 50]"
            >
              <Column field="fullName" header="Student" />
              <Column field="email" header="Email" />
              <Column header="Progress">
                <template #body="{ data }">
                  <div class="progress-cell">
                    <ProgressBar :value="data.percent" style="width: 160px" />
                    <span class="pct">{{ data.percent }}%</span>
                  </div>
                </template>
              </Column>
              <Column field="nextLessonTitle" header="Next Lesson" />
            </DataTable>

            <div v-if="!filteredStudents.length" class="empty-state">
              No students match your search.
            </div>
          </template>

          <div v-else class="empty-state">
            No students assigned to this group yet.
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import api from '../api/axios'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const group = ref(null)
const students = ref([])
const loading = ref(true)
const error = ref(false)
const filter = ref('')

const mapProgress = (progressList) =>
  progressList.reduce((acc, item) => {
    acc[item.studentId] = item
    return acc
  }, {})

const loadData = async () => {
  loading.value = true
  error.value = false

  try {
    // Get group header info (name/schedule) from instructor groups list
    const groupsRes = await api.get('/instructor/groups')
    group.value = groupsRes.data
      .map((g) => ({
        id: g.group_id,
        name: g.group_name,
        schedule_text: g.schedule_text,
      }))
      .find((g) => g.id === route.params.id)

    if (!group.value) {
      group.value = { name: 'Group', schedule_text: '' }
    }

    // Fetch students + progress in parallel
    const [studentsRes, progressRes] = await Promise.all([
      api.get(`/groups/${route.params.id}/students`),
      api.get(`/groups/${route.params.id}/progress`),
    ])

    const progressMap = mapProgress(
      (progressRes.data || []).map((p) => ({
        studentId: p.studentId,
        percent: p.percent,
        nextLessonTitle: p.nextLessonTitle,
      })),
    )

    students.value = (studentsRes.data || []).map((student) => ({
      id: student.id,
      fullName: student.full_name,
      email: student.email,
      percent: progressMap[student.id]?.percent ?? 0,
      nextLessonTitle: progressMap[student.id]?.nextLessonTitle ?? '—',
    }))
  } catch (err) {
    error.value = true
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load group',
      life: 3000,
    })
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.push('/instructor')
}

const filteredStudents = computed(() => {
  const term = filter.value.trim().toLowerCase()
  const sorted = [...students.value].sort((a, b) => (b.percent || 0) - (a.percent || 0))
  if (!term) return sorted

  return sorted.filter((s) => {
    const name = (s.fullName || '').toLowerCase()
    const email = (s.email || '').toLowerCase()
    return name.includes(term) || email.includes(term)
  })
})

const totalStudents = computed(() => students.value.length)

const averagePercent = computed(() => {
  if (!students.value.length) return 0
  const sum = students.value.reduce((acc, s) => acc + (s.percent || 0), 0)
  return Math.round(sum / students.value.length)
})

onMounted(() => {
  loadData()
})

watch(
  () => route.params.id,
  (newId, oldId) => {
    if (newId && newId !== oldId) loadData()
  },
)
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary {
  display: flex;
  gap: 2rem;
  margin-bottom: 1rem;
}

.summary small {
  display: block;
  color: #6b7280;
  font-size: 0.85rem;
}

.summary strong {
  font-size: 1.25rem;
}

.table-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.control-label {
  font-size: 0.85rem;
  color: #6b7280;
}

.progress-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pct {
  width: 3ch;
  text-align: right;
  color: #6b7280;
  font-size: 0.85rem;
}

.empty-state {
  margin-top: 1rem;
  color: #6b7280;
}
</style>
