<template>
  <div class="auth-page" :style="pageStyle">
    <section class="auth-shell">
      <div class="auth-brand-panel" :style="brandPanelStyle">
        <div class="auth-brand-overlay"></div>

        <div class="auth-brand-content">
          <div class="auth-logo-wrap" v-if="branding.logo">
            <img
              :src="branding.logo"
              :alt="branding.companyName"
              class="auth-logo"
            />
          </div>

          <div class="auth-badge">
            {{ branding.badge }}
          </div>

          <h1 class="auth-brand-title">
            {{ branding.welcomeTitle }}
          </h1>

          <p class="auth-brand-text">
            {{ branding.welcomeText }}
          </p>

          <div class="auth-feature-list">
            <div
              v-for="feature in branding.features"
              :key="feature"
              class="auth-feature-item"
            >
              <i class="pi pi-check-circle"></i>
              <span>{{ feature }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="auth-form-panel">
        <Card class="auth-card">
          <template #content>
            <div class="auth-card-top">
              <div class="auth-mascot" :style="mascotStyle">
                <img
                  v-if="branding.logo"
                  :src="branding.logo"
                  :alt="branding.companyName"
                  class="auth-mascot-logo"
                />
                <Avatar
                  v-else
                  icon="pi pi-star-fill"
                  size="large"
                />
              </div>
            </div>

            <header class="auth-header">
              <h2 class="auth-title">Iniciar sesión</h2>
              <p class="auth-subtitle">Ingresa tus datos para continuar</p>
            </header>

            <form class="auth-form" @submit.prevent="handleLogin" novalidate>
              <div class="field">
                <label class="field-label" for="email">
                  {{ t('login.email') }}
                </label>

                <div class="input-shell">
                  <i class="pi pi-envelope input-icon"></i>
                  <InputText
                    id="email"
                    v-model.trim="email"
                    type="email"
                    placeholder="tu@correo.com"
                    autocomplete="email"
                    class="w-full auth-input-text"
                    :class="{ 'is-invalid': !!errors.email }"
                    @input="clearFieldError('email')"
                    @blur="validateEmailField"
                    required
                  />
                </div>

                <small v-if="errors.email" class="field-error">
                  {{ errors.email }}
                </small>
              </div>

              <div class="field">
                <label class="field-label" for="password">
                  {{ t('login.password') }}
                </label>

                <div class="input-shell">
                  <i class="pi pi-lock input-icon"></i>
                  <Password
                    id="password"
                    v-model="password"
                    placeholder="••••••••"
                    :toggleMask="true"
                    :feedback="false"
                    autocomplete="current-password"
                    class="w-full auth-password"
                    inputClass="auth-password-input"
                    :class="{ 'is-invalid': !!errors.password }"
                    @input="clearFieldError('password')"
                    @blur="validatePasswordField"
                    required
                  />
                </div>

                <small v-if="errors.password" class="field-error">
                  {{ errors.password }}
                </small>
              </div>

              <transition name="fade">
                <div v-if="generalError" class="auth-alert auth-alert-error">
                  <i class="pi pi-exclamation-circle"></i>
                  <span>{{ generalError }}</span>
                </div>
              </transition>

              <div class="auth-row">
                <button type="button" class="auth-link" @click="onForgot">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <Button
                type="submit"
                :label="auth.loading ? 'Validando...' : t('login.signIn')"
                icon="pi pi-arrow-right"
                iconPos="right"
                class="auth-submit"
                :loading="auth.loading"
              />
            </form>
          </template>
        </Card>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';
import { branding } from '../config/branding';

const email = ref('');
const password = ref('');
const generalError = ref('');

const errors = reactive({
  email: '',
  password: '',
});

const auth = useAuthStore();
const router = useRouter();
const toast = useToast();
const { t } = useI18n();

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const pageStyle = computed(() => ({
  '--brand-page-start': branding.colors.pageStart,
  '--brand-page-end': branding.colors.pageEnd,
  '--brand-primary': branding.colors.primary,
  '--brand-primary-dark': branding.colors.primaryDark,
  '--brand-primary-soft': branding.colors.primarySoft,
  '--brand-accent': branding.colors.accent,
  '--brand-surface': branding.colors.surface,
  '--brand-surface-soft': branding.colors.surfaceSoft,
  '--brand-border': branding.colors.border,
  '--brand-text': branding.colors.text,
  '--brand-text-muted': branding.colors.textMuted,
  '--brand-text-soft': branding.colors.textSoft,
  '--brand-success': branding.colors.success,
  '--brand-danger': branding.colors.danger,
}));

const brandPanelStyle = computed(() => ({
  background: `
    radial-gradient(circle at bottom left, rgba(255, 255, 255, 0.16), transparent 34%),
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.12), transparent 28%),
    linear-gradient(135deg, ${branding.colors.primaryDark} 0%, ${branding.colors.primary} 55%, ${branding.colors.primarySoft} 100%)
  `,
}));

const mascotStyle = computed(() => ({
  borderColor: 'rgba(191, 219, 254, 0.95)',
}));

const clearFieldError = (field) => {
  errors[field] = '';
  generalError.value = '';
};

const validateEmailField = () => {
  if (!email.value) {
    errors.email = 'El correo electrónico es obligatorio';
    return false;
  }

  if (!emailRegex.test(email.value)) {
    errors.email = 'Ingresa un correo electrónico válido';
    return false;
  }

  errors.email = '';
  return true;
};

const validatePasswordField = () => {
  if (!password.value) {
    errors.password = 'La contraseña es obligatoria';
    return false;
  }

  if (password.value.length < 6) {
    errors.password = 'La contraseña debe tener al menos 6 caracteres';
    return false;
  }

  errors.password = '';
  return true;
};

const validateForm = () => {
  const isEmailValid = validateEmailField();
  const isPasswordValid = validatePasswordField();
  return isEmailValid && isPasswordValid;
};

const handleLogin = async () => {
  generalError.value = '';

  const isValid = validateForm();
  if (!isValid) return;

  try {
    await auth.login(email.value, password.value);
    router.push(auth.getDefaultRoute());
  } catch (err) {
    generalError.value =
      'Correo o contraseña incorrectos. Verifica tus datos e intenta nuevamente.';

    toast.add({
      severity: 'error',
      summary: t('login.failed'),
      detail: t('login.invalidCredentials'),
      life: 3000,
    });
  }
};

const onForgot = () => {
  toast.add({
    severity: 'info',
    summary: 'Recuperación de contraseña',
    detail: 'Próximamente estará disponible este flujo.',
    life: 2500,
  });
};
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  padding: 24px;
  background:
    radial-gradient(700px 360px at 12% 18%, color-mix(in srgb, var(--brand-primary) 18%, transparent), transparent 60%),
    radial-gradient(640px 320px at 88% 82%, color-mix(in srgb, var(--brand-success) 14%, transparent), transparent 60%),
    linear-gradient(180deg, var(--brand-page-start) 0%, var(--brand-page-end) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.auth-shell {
  width: min(1120px, 100%);
  min-height: 680px;
  display: grid;
  grid-template-columns: 1.08fr 0.92fr;
  border-radius: 32px;
  overflow: hidden;
  background: var(--brand-surface-soft);
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow:
    0 24px 70px rgba(15, 23, 42, 0.10),
    0 10px 30px rgba(15, 23, 42, 0.06);
  backdrop-filter: blur(14px);
}

.auth-brand-panel {
  position: relative;
  overflow: hidden;
  padding: 56px;
  display: flex;
  align-items: center;
}

.auth-brand-overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0)),
    radial-gradient(circle at 18% 82%, rgba(255,255,255,0.12), transparent 24%);
  pointer-events: none;
}

.auth-brand-content {
  position: relative;
  z-index: 1;
  max-width: 460px;
  color: #ffffff;
}

.auth-logo-wrap {
  margin-bottom: 18px;
}

.auth-logo {
  display: block;
  max-width: 220px;
  width: 100%;
  max-height: 88px;
  object-fit: contain;
  object-position: left center;
  filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.16));
}

.auth-badge {
  display: inline-flex;
  align-items: center;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.18);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  margin-bottom: 24px;
}

.auth-brand-title {
  margin: 0 0 16px;
  font-size: clamp(2.3rem, 4vw, 3.5rem);
  line-height: 1.05;
  font-weight: 900;
}

.auth-brand-text {
  margin: 0;
  font-size: 1.02rem;
  line-height: 1.8;
  color: rgba(255, 255, 255, 0.88);
  max-width: 420px;
}

.auth-feature-list {
  margin-top: 32px;
  display: grid;
  gap: 14px;
}

.auth-feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.95);
  font-weight: 600;
}

.auth-feature-item i {
  font-size: 1rem;
}

.auth-form-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 36px;
  background: linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.92));
}

.auth-card {
  width: 100%;
  max-width: 420px;
  border-radius: 28px;
  border: 1px solid var(--brand-border);
  background: var(--brand-surface);
  box-shadow:
    0 20px 40px rgba(15, 23, 42, 0.08),
    0 8px 18px rgba(15, 23, 42, 0.04);
  position: relative;
}

.auth-card :deep(.p-card-body) {
  padding: 32px;
}

.auth-card-top {
  position: relative;
  height: 18px;
}

.auth-mascot {
  position: absolute;
  top: -62px;
  right: -4px;
  background: linear-gradient(180deg, #eef5ff 0%, #dbeafe 100%);
  border: 1px solid rgba(191, 219, 254, 0.95);
  border-radius: 999px;
  padding: 10px;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.12);
  width: 78px;
  height: 78px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.auth-mascot-logo {
  width: 52px;
  height: 52px;
  object-fit: contain;
  display: block;
}

.auth-header {
  margin-bottom: 24px;
}

.auth-title {
  margin: 0;
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 900;
  color: var(--brand-text);
}

.auth-subtitle {
  margin: 10px 0 0;
  color: var(--brand-text-muted);
  font-size: 0.98rem;
}

.auth-form {
  display: flex;
  flex-direction: column;
}

.field {
  display: grid;
  gap: 8px;
  margin-bottom: 16px;
}

.field-label {
  font-weight: 800;
  font-size: 0.9rem;
  color: #334155;
}

.w-full {
  width: 100%;
}

.input-shell {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.input-icon {
  position: absolute;
  left: 14px;
  z-index: 2;
  color: var(--brand-text-soft);
  font-size: 0.95rem;
  pointer-events: none;
}

:deep(.auth-input-text.p-inputtext) {
  width: 100%;
  min-height: 52px;
  border-radius: 14px;
  border: 1px solid #d9e2ec;
  background: #f8fafc;
  padding-left: 42px;
  transition: all 0.2s ease;
}

:deep(.auth-input-text.p-inputtext:enabled:focus) {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand-primary) 12%, transparent);
  background: #ffffff;
}

:deep(.auth-password) {
  width: 100%;
}

:deep(.auth-password .p-inputtext),
:deep(.auth-password-input) {
  width: 100%;
  min-height: 52px;
  border-radius: 14px;
  border: 1px solid #d9e2ec;
  background: #f8fafc;
  padding-left: 42px;
  transition: all 0.2s ease;
}

:deep(.auth-password .p-inputtext:enabled:focus),
:deep(.auth-password-input:enabled:focus) {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand-primary) 12%, transparent);
  background: #ffffff;
}

:deep(.is-invalid.p-inputtext),
:deep(.is-invalid .p-inputtext),
:deep(.is-invalid.auth-password .p-inputtext),
:deep(.auth-password.is-invalid .p-inputtext),
:deep(.auth-password-input.is-invalid) {
  border-color: #ef4444 !important;
  background: #fff7f7 !important;
}

:deep(.p-password .p-password-input-icon),
:deep(.p-password .p-password-toggle-mask-icon),
:deep(.p-password i.pi-eye),
:deep(.p-password i.pi-eye-slash) {
  color: var(--brand-text-soft);
  margin-right: 10px;
}

.field-error {
  color: var(--brand-danger);
  font-size: 0.84rem;
  font-weight: 600;
  margin-top: 2px;
}

.auth-alert {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  border-radius: 14px;
  padding: 12px 14px;
  margin: 2px 0 16px;
  font-size: 0.92rem;
  font-weight: 600;
}

.auth-alert-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
}

.auth-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin: 4px 0 18px;
}

.auth-link {
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: var(--brand-primary);
  font-weight: 700;
  font-size: 0.92rem;
}

.auth-link:hover {
  text-decoration: underline;
}

.auth-submit {
  width: 100%;
  min-height: 54px;
  border-radius: 14px;
  font-weight: 800;
  font-size: 1rem;
}

.auth-submit:not(.p-disabled):hover {
  box-shadow: 0 14px 24px color-mix(in srgb, var(--brand-primary) 18%, transparent);
  transform: translateY(-1px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 992px) {
  .auth-shell {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .auth-brand-panel {
    min-height: 300px;
    padding: 34px 24px;
  }

  .auth-logo {
    max-width: 180px;
    max-height: 72px;
  }

  .auth-form-panel {
    padding: 24px;
  }

  .auth-card {
    max-width: 100%;
  }

  .auth-mascot {
    top: -48px;
    right: 8px;
    width: 72px;
    height: 72px;
  }

  .auth-mascot-logo {
    width: 46px;
    height: 46px;
  }
}

@media (max-width: 576px) {
  .auth-page {
    padding: 12px;
  }

  .auth-shell {
    border-radius: 22px;
  }

  .auth-brand-panel {
    padding: 24px 20px;
    min-height: 240px;
  }

  .auth-logo-wrap {
    margin-bottom: 14px;
  }

  .auth-logo {
    max-width: 150px;
    max-height: 58px;
  }

  .auth-form-panel {
    padding: 16px;
  }

  .auth-card :deep(.p-card-body) {
    padding: 22px 18px;
  }

  .auth-title {
    font-size: 1.6rem;
  }

  .auth-brand-title {
    font-size: 2rem;
    line-height: 1.05;
  }

  .auth-brand-text {
    font-size: 0.94rem;
    line-height: 1.6;
  }

  .auth-feature-list {
    gap: 10px;
    margin-top: 22px;
  }

  .auth-feature-item {
    font-size: 0.9rem;
  }

  .auth-row {
    justify-content: flex-start;
  }

  .auth-link {
    font-size: 0.88rem;
  }

  .auth-mascot {
    top: -42px;
    right: 4px;
    width: 64px;
    height: 64px;
    padding: 8px;
  }

  .auth-mascot-logo {
    width: 40px;
    height: 40px;
  }
}
</style>