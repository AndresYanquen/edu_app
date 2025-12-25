<template>
  <Toast position="top-right" />
  <div v-if="!auth.initialized" class="loading-screen">
    <ProgressSpinner />
  </div>
  <div v-else>
    <AppShell v-if="auth.isAuthenticated">
      <router-view />
    </AppShell>
    <router-view v-else />
  </div>
</template>

<script setup>
import { useAuthStore } from './stores/auth';
import AppShell from './components/AppShell.vue';

const auth = useAuthStore();
</script>

<style scoped>
.loading-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
