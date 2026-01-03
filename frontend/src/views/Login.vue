<template>
  <div class="auth-page">
    <Card class="auth-card">
      <template #content>
        <div class="auth-mascot">
          <Avatar icon="pi pi-star-fill" size="large" />
        </div>

        <header class="auth-header">
          <p class="auth-title">Welcome back</p>
          <p class="auth-subtitle">Continue where you left off.</p>
        </header>

        <form class="auth-form" @submit.prevent="handleLogin">
          <div class="field">
            <label class="field-label" for="email">{{ t('login.email') }}</label>
            <span class="p-input-icon-left w-full">
              <i class="pi pi-envelope" />
              <InputText
                id="email"
                v-model="email"
                type="email"
                placeholder="you@email.com"
                autocomplete="email"
                class="w-full"
                required
              />
            </span>
          </div>

          <div class="field">
            <label class="field-label" for="password">{{ t('login.password') }}</label>
            <span class="p-input-icon-left w-full">
              <i class="pi pi-lock" />
              <Password
                id="password"
                v-model="password"
                placeholder="••••••••"
                :toggleMask="true"
                :feedback="false"
                autocomplete="current-password"
                class="w-full"
                inputClass="w-full"
                required
              />
            </span>
          </div>

          <div class="auth-row">
            <!-- <div class="remember">
              <Checkbox inputId="remember" v-model="rememberMe" binary />
              <label for="remember">Remember me</label>
            </div> -->

            <button type="button" class="auth-link" @click="onForgot">
              Forgot password?
            </button>
          </div>

          <Button
            type="submit"
            :label="t('login.signIn')"
            icon="pi pi-arrow-right"
            iconPos="right"
            class="auth-submit"
            :loading="auth.loading"
          />
        </form>
      </template>
    </Card>
  </div>
</template>


<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';

const email = ref('');
const password = ref('');
const rememberMe = ref(false);

const auth = useAuthStore();
const router = useRouter();
const toast = useToast();
const { t } = useI18n();

const handleLogin = async () => {
  try {
    await auth.login(email.value, password.value);
    router.push(auth.getDefaultRoute());
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('login.failed'),
      detail: t('login.invalidCredentials'),
      life: 3000,
    });
  }
};

const onForgot = () => {
  // Si tienes ruta /forgot, úsala:
  // router.push('/forgot');
  toast.add({
    severity: 'info',
    summary: 'Forgot password',
    detail: 'Password reset flow coming soon.',
    life: 2500,
  });
};
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(600px 300px at 20% 20%, rgba(251, 191, 36, 0.2), transparent 60%),
    radial-gradient(600px 300px at 80% 30%, rgba(34, 197, 94, 0.18), transparent 60%),
    linear-gradient(180deg, var(--app-bg) 0%, #ffffff 100%);
}

.auth-card {
  width: min(420px, 92vw);
  border-radius: 22px;
  border: 1px solid var(--app-border);
  background: var(--app-surface);
  box-shadow: var(--shadow-md);
  position: relative;
}

/* Card padding real (PrimeVue mete contenido dentro de .p-card-body) */
.auth-card :deep(.p-card-body) {
  padding: 22px;
}

/* Mascot badge */
.auth-mascot {
  position: absolute;
  top: -18px;
  right: -18px;
  background: var(--brand-accent-soft);
  border: 1px solid rgba(251, 191, 36, 0.35);
  border-radius: 999px;
  padding: 10px;
  box-shadow: var(--shadow-sm);
}

/* Header */
.auth-header {
  margin-bottom: 18px;
}

.auth-title {
  font-size: 1.25rem;
  font-weight: 900;
  margin: 0;
}

.auth-subtitle {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

/* Form */
.auth-form {
  display: flex;
  flex-direction: column;
}

.field {
  display: grid;
  gap: 6px;
  margin-bottom: 14px;
}

.field-label {
  font-weight: 800;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

/* Icon color */
.p-input-icon-left > i {
  color: var(--text-muted);
  margin-right: 0.5rem;
  font-size: 1.1rem;
}

/* Make icon-left wrapper full width */
.w-full {
  width: 100%;
  display: block;
}

.p-input-icon-left {
  display: flex;
  align-items: center;
  width: 100%;
}

:deep(.p-input-icon-left .p-inputtext),
:deep(.p-input-icon-left input) {
  width: 100%;
}

:deep(.p-password .p-inputtext) {
  width: 100%;
}

/* Ensure Password root uses full width */
:deep(.p-password) {
  width: 100%;
}

/* Row actions */
.auth-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 6px 0 14px;
}

.remember {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-secondary);
  font-weight: 700;
  font-size: 0.9rem;
}

/* Link as button (better a11y + no href="#") */
.auth-link {
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: var(--brand-primary-hover);
  font-weight: 800;
  text-decoration: none;
}

.auth-link:hover {
  text-decoration: underline;
}

/* Submit */
.auth-submit {
  width: 100%;
  font-weight: 800;
}

.auth-submit:not(.p-disabled):hover {
  box-shadow: 0 10px 20px rgba(34, 197, 94, 0.2);
}
</style>
