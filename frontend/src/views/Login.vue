<template>
  <div class="login-container">
    <Card>
      <template #title>{{ t('login.title') }}</template>
      <template #content>
        <form class="p-fluid" @submit.prevent="handleLogin">
          <div class="field">
            <label for="email">{{ t('login.email') }}</label>
            <InputText id="email" v-model="email" type="email" required />
          </div>
          <div class="field">
            <label for="password">{{ t('login.password') }}</label>
            <Password id="password" v-model="password" toggle-mask :feedback="false" required />
          </div>
          <Button
            type="submit"
            :label="t('login.signIn')"
            class="p-button-primary"
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
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem;
  background: #f5f7fb;
}

.field {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
}
</style>
