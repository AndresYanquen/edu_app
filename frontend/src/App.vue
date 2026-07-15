<template>
  <Toast position="top-right" />
  <div v-if="!auth.initialized" class="loading-screen">
    <ProgressSpinner />
  </div>
  <div id="app-container" v-else>
    <AppShell v-if="auth.isAuthenticated">
      <router-view />
    </AppShell>
    <router-view v-else />
  </div>
</template>

<script setup>
import { useAuthStore } from './stores/auth';
import AppShell from './components/AppShell.vue';
import { useZendeskWidget } from './composables/useZendeskWidget';

const auth = useAuthStore();

useZendeskWidget();
</script>

<style scoped>
.loading-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
#app-container{
  font-size: 12px;
}

</style>
