<template>
  <p v-if="loading">Checking your sign-in…</p>
  <p v-else-if="error">{{ error }}</p>
  <ChooseUsername
    v-else-if="user && user.username === null"
    @saved="user.username = $event"
  />

  <div v-else-if="user">
    <img v-if="user.avatar" :src="user.avatar" alt="Profile avatar" />
    <span>{{ user.username ?? 'No nickname yet' }}</span>
    <RoomConversation
      :key="selectedRoom.room_id"
      :room-id="selectedRoom.room_id"
      :title="selectedRoom.title"
    />
  </div>

  <p v-else>
    You’re signed out. <RouterLink to="/">Go to sign in</RouterLink>
  </p>
</template>

<script setup>
import RoomConversation from '../components/RoomConversation.vue';

//Hardcoded for now, before a room selector is added into the UI
const selectedRoom = { room_id: '1', title: 'General' };

console.log('ChatRoom.vue loaded');
import { useAuth } from '../composables/useAuth';
import ChooseUsername from '../components/ChooseUsername.vue';

const { user, loading, error } = useAuth();
</script>   