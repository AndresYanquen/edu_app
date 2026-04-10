<template>
  <div class="auth-page">
    <Card class="auth-card">
      <template #title>
        <div class="auth-card__header">
          <div class="auth-icon">
            <i class="pi pi-lock" />
          </div>
          <div class="auth-title-block">
            <h1>{{ t('activate.title') }}</h1>
            <p>{{ t('activate.subtitle') || 'Crea tu nueva contraseña para activar tu acceso.' }}</p>
          </div>
        </div>
      </template>

      <template #content>
        <div v-if="!token" class="empty-state">
          <div class="empty-state__icon">
            <i class="pi pi-exclamation-circle" />
          </div>
          <p>{{ t('activate.missingToken') }}</p>
        </div>

        <div v-else class="auth-form">
          <div class="dialog-field">
            <label>{{ t('activate.newPassword') }}</label>
            <Password
              v-model="form.password"
              toggleMask
              :feedback="false"
              class="field-control"
            />
          </div>

          <div class="dialog-field">
            <label>{{ t('activate.confirmPassword') }}</label>
            <Password
              v-model="form.confirm"
              toggleMask
              :feedback="false"
              class="field-control"
            />
          </div>

          <div v-if="error" class="error-box">
            <i class="pi pi-info-circle" />
            <span>{{ error }}</span>
          </div>

          <Button
            :label="t('activate.activate')"
            :loading="submitting"
            class="activate-btn"
            @click="submit"
          />
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useI18n } from 'vue-i18n';
import api from '../api/axios';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { t } = useI18n();

const token = route.query.token || '';
const form = ref({ password: '', confirm: '' });
const submitting = ref(false);
const error = ref('');

const validate = () => {
  if (!form.value.password || !form.value.confirm) {
    error.value = t('activate.errors.required');
    return false;
  }

  if (form.value.password !== form.value.confirm) {
    error.value = t('activate.errors.mismatch');
    return false;
  }

  error.value = '';
  return true;
};

const submit = async () => {
  if (!token || !validate()) return;

  submitting.value = true;

  try {
    await api.post('/auth/activate', {
      token,
      password: form.value.password,
    });

    toast.add({
      severity: 'success',
      summary: t('activate.success'),
      life: 2500,
    });

    router.push('/login');
  } catch (err) {
    error.value = err.response?.data?.error || t('activate.errors.failed');
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
.auth-page,
.auth-page * {
  box-sizing: border-box;
  min-width: 0;
}

.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at top, rgba(59, 130, 246, 0.12), transparent 28%),
    linear-gradient(180deg, #eef2ff 0%, #f8fbff 100%);
  padding: 1rem;
}

.auth-card {
  width: 100%;
  max-width: 460px;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow:
    0 18px 40px rgba(15, 23, 42, 0.08),
    0 4px 14px rgba(15, 23, 42, 0.05);
  overflow: hidden;
}

.auth-card__header {
  display: flex;
  align-items: flex-start;
  gap: 0.95rem;
  padding-top: 0.2rem;
}

.auth-icon {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%);
  color: #2563eb;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.auth-title-block {
  min-width: 0;
}

.auth-title-block h1 {
  margin: 0;
  font-size: 1.55rem;
  line-height: 1.1;
  color: #0f172a;
  font-weight: 800;
}

.auth-title-block p {
  margin: 0.35rem 0 0;
  color: #64748b;
  line-height: 1.55;
  font-size: 0.94rem;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.dialog-field {
  display: flex;
  flex-direction: column;
  gap: 0.42rem;
  margin-bottom: 1rem;
}

.dialog-field label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #334155;
}

.field-control {
  width: 100%;
}

.field-control :deep(.p-password),
.field-control :deep(.p-inputtext) {
  width: 100%;
}

.error-box {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  border: 1px solid rgba(239, 68, 68, 0.18);
  background: #fef2f2;
  color: #b91c1c;
  border-radius: 14px;
  padding: 0.85rem 0.95rem;
  margin-bottom: 0.9rem;
  line-height: 1.45;
}

.error-box i {
  margin-top: 0.1rem;
  flex-shrink: 0;
}

.activate-btn {
  width: 100%;
  min-height: 46px;
  border-radius: 14px;
  font-weight: 700;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: #475569;
  padding: 0.5rem 0;
}

.empty-state__icon {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: #eff6ff;
  color: #2563eb;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.35rem;
  margin-bottom: 0.9rem;
}

.empty-state p {
  margin: 0;
  line-height: 1.55;
  max-width: 30ch;
}

@media (max-width: 640px) {
  .auth-page {
    padding: 0.85rem;
    align-items: stretch;
  }

  .auth-card {
    max-width: 100%;
    border-radius: 18px;
    align-self: center;
  }

  .auth-card__header {
    gap: 0.8rem;
  }

  .auth-icon {
    width: 46px;
    height: 46px;
    border-radius: 14px;
    font-size: 1.1rem;
  }

  .auth-title-block h1 {
    font-size: 1.32rem;
  }

  .auth-title-block p {
    font-size: 0.9rem;
  }

  .dialog-field {
    margin-bottom: 0.9rem;
  }

  .error-box {
    padding: 0.8rem 0.85rem;
    border-radius: 12px;
  }
}
</style>