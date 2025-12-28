<template>
  <div class="auth-page">
    <Card class="auth-card">
      <template #title>Activate your account</template>
      <template #content>
        <div v-if="!token" class="empty-state">
          Missing activation token. Check your link.
        </div>
        <div v-else>
          <div class="dialog-field">
            <label>New password</label>
            <Password v-model="form.password" toggleMask :feedback="false" />
          </div>
          <div class="dialog-field">
            <label>Confirm password</label>
            <Password v-model="form.confirm" toggleMask :feedback="false" />
          </div>
          <div v-if="error" class="error-text">{{ error }}</div>
          <Button label="Activate" :loading="submitting" class="w-full" @click="submit" />
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import api from '../api/axios';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const token = route.query.token || '';
const form = ref({ password: '', confirm: '' });
const submitting = ref(false);
const error = ref('');

const validate = () => {
  if (!form.value.password || !form.value.confirm) {
    error.value = 'Both fields are required';
    return false;
  }
  if (form.value.password !== form.value.confirm) {
    error.value = 'Passwords must match';
    return false;
  }
  error.value = '';
  return true;
};

const submit = async () => {
  if (!token || !validate()) return;
  submitting.value = true;
  try {
    await api.post('/auth/activate', { token, password: form.value.password });
    toast.add({ severity: 'success', summary: 'Account activated', life: 2500 });
    router.push('/login');
  } catch (err) {
    error.value = err.response?.data?.error || 'Activation failed';
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eef2ff;
  padding: 1rem;
}
.auth-card {
  width: 100%;
  max-width: 420px;
}
.dialog-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 1rem;
}
.error-text {
  color: #dc2626;
  margin-bottom: 0.75rem;
}
.empty-state {
  color: #475569;
}
</style>
