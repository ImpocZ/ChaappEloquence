<template>
  <div v-if="!loading">
    <img :src="user.avatar" :alt="user.login" />
    <span>{{ user.login }}</span>
    <!-- chat stuff -->
  </div>
</template>

<script setup>
console.log('ChatRoom.vue loaded');
import { useAuth } from '../composables/useAuth';

const { user, loading } = useAuth();
</script>   