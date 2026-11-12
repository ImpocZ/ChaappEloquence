<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { io } from 'socket.io-client';

const messages = ref([]);
const loading = ref(true);
const error = ref('');

const props = defineProps({
  roomId: { type: String, required: true },
  title: { type: String, required: true },
});

async function loadMessages() {
    loading.value = true;
    error.value = '';
    try {
        const response = await fetch(`http://localhost:3001/api/rooms/${props.roomId}/messages`, {
        credentials: 'include',
    });

    if (response.status === 401) {
        error.value = 'Your session expired. Sign in again to load messages.';
        return;
    }

    if (response.status === 403) {
        error.value = 'You do not have access to this room.';
        return;
    }

    if (!response.ok) {
        throw new Error(`Message request failed (${response.status})`);
    }

    messages.value = await response.json();
  } catch (err) {
        console.error('Could not load messages:', err);
        error.value = 'Could not load messages. Try refreshing.';
  } finally {
        loading.value = false;
  }
};

const draft = ref('');
const sending = ref(false);
const sendError = ref('');

async function sendMessage() {
  const content = draft.value.trim();
  if (!content || sending.value) return;

  sending.value = true;
  sendError.value = '';

  try {
    const response = await fetch(
      `http://localhost:3001/api/rooms/${props.roomId}/messages`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      },
    );

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        sendError.value = data.error || 'Could not send your message.';
        return;
    }

    draft.value = '';
    await loadMessages();
    } catch {
        sendError.value = 'Could not confirm the send. Check the room before retrying.';
    } finally {
        sending.value = false;
    }
}

let socket;

onMounted(() => {
    loadMessages();

    socket = io('http://localhost:3001', {
    withCredentials: true,
    auth: { roomId: props.roomId },
    });

    socket.on('room:ready', loadMessages);
    socket.on('messages:changed', loadMessages);

    socket.on('connect_error', error => {
        console.error('Chat socket could not connect:', error.message);
    });
});

onUnmounted(() => {
    socket?.disconnect();
});
</script>

<template>
  <section>
    <h2>{{ props.title }}</h2>

    <p v-if="loading">Loading messages…</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <p v-else-if="messages.length === 0">No messages yet.</p>

    <ul v-else>
      <li v-for="message in messages" :key="message.message_id">
        <strong>{{ message.username }}</strong>
        <p>{{ message.content }}</p>
      </li>
    </ul>
    <form v-if="!loading && !error" @submit.prevent="sendMessage">
        <label for="message-draft">Message</label>
        <input id="message-draft" v-model="draft" :disabled="sending" />

        <button type="submit" :disabled="sending || !draft.trim()">
            {{ sending ? 'Sending…' : 'Send' }}
        </button>

        <p v-if="sendError" role="alert">{{ sendError }}</p>
    </form>
  </section>
</template>