<template>
  <div class="page community-forum-page">
    <Card>
      <template #title>
        <div class="community-header">
          <div>
            <h2>Comunidad</h2>
            <p>Foro global para todos los estudiantes y staff.</p>
          </div>
        </div>
      </template>
      <template #content>
        <ForumBoard :scopes="['global', 'group']" />
      </template>
    </Card>
  </div>
</template>

<script setup>
import ForumBoard from '../components/forums/ForumBoard.vue';
</script>

<style scoped>
.community-header h2 {
  margin: 0;
}

.community-header p {
  margin: 0.25rem 0 0;
  color: #64748b;
}
</style>
