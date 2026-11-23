<template>
  <p v-if="loading">Checking your sign-in…</p>
  <p v-else-if="error">{{ error }}</p>
  <ChooseUsername v-else-if="user && user.username === null" @saved="user.username = $event" />

  <div v-else-if="user">
    <img v-if="user.avatar" :src="user.avatar" alt="Profile avatar" />
    <span>{{ user.username ?? 'No nickname yet' }}</span>
    <p v-if="roomsLoading">Loading rooms…</p>
    <p v-else-if="roomsError" role="alert">{{ roomsError }}</p>

    <div v-else class="flex flex-wrap gap-6">
      <nav aria-label="General rooms" class="flex flex-col items-start gap-2">
        <h2>General rooms</h2>

        <button class = 'hover:bg-sky-700' v-for=" room in rooms.filter(room => room.type === 'general')" :key="room.room_id" type="button"
          :aria-pressed="selectedRoom?.room_id === room.room_id" @click="selectedRoom = room">
          {{ room.name }}
        </button>
      </nav>

      <div class="min-w-0 flex-1">
        <RoomConversation v-if="selectedRoom" :key="selectedRoom.room_id" :room-id="String(selectedRoom.room_id)"
          :title="selectedRoom.name" />
        <p v-else>No general rooms available.</p>
      </div>
    </div>
  </div>

  <p v-else>
    You’re signed out. <RouterLink to="/">Go to sign in</RouterLink>
  </p>
</template>

<script setup>
import { ref, watch } from 'vue';

import RoomConversation from '../components/RoomConversation.vue';

//Hardcoded for now, before a room selector is added into the UI
//const selectedRoom = { room_id: '1', title: 'General' };

console.log('ChatRoom.vue loaded');
import { useAuth } from '../composables/useAuth';
import ChooseUsername from '../components/ChooseUsername.vue';

const { user, loading, error } = useAuth();

const rooms = ref([]);
const selectedRoom = ref(null);
const roomsLoading = ref(false);
const roomsError = ref('');

async function loadRooms() {
  roomsLoading.value = true;
  roomsError.value = '';

  try {
    const response = await fetch('/api/rooms', {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Room request failed (${response.status})`);
    }

    rooms.value = await response.json();
    selectedRoom.value = rooms.value.find(room => room.type === 'general') ?? null;
  } catch (err) {
    console.error('Could not load rooms:', err);
    roomsError.value = 'Could not load your rooms. Try refreshing.';
  } finally {
    roomsLoading.value = false;
  }
}

watch(
  () => Boolean(user.value?.username),
  hasUsername => {
    if (hasUsername) loadRooms();
  },
  { immediate: true },
);
</script>