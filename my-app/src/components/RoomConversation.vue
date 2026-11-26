<script setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { io } from 'socket.io-client';

const props = defineProps({
  roomId: { type: String, required: true },
  title: { type: String, required: true },
});

const messages = ref([]);
const loading = ref(true);
const error = ref('');

const draft = ref('');
const sending = ref(false);
const sendError = ref('');

const replyingTo = ref(null);
const openMenuId = ref(null);
const draftInput = ref(null);
const contextMessageId = ref(null);
const jumping = ref(false);
const jumpError = ref('');

function formatDate(value) {
  return new Date(value).toLocaleString();
}

async function loadMessages() {
  error.value = '';

  try {
    const url = contextMessageId.value
      ? `/api/rooms/${props.roomId}/messages/${contextMessageId.value}/context`
      : `/api/rooms/${props.roomId}/messages`;

    const response = await fetch(url, {
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

    if (replyingTo.value) {
      const original = messages.value.find(
        message => message.message_id === replyingTo.value.message_id,
      );

      if (original?.deleted_at) {
        replyingTo.value = null;
        sendError.value =
          'The message you were replying to was deleted. Choose another reply.';
      }
    }
  } catch (err) {
    console.error('Could not load messages:', err);
    error.value = 'Could not load messages. Try refreshing.';
  } finally {
    loading.value = false;
  }
}

function toggleMenu(messageId) {
  openMenuId.value =
    openMenuId.value === messageId ? null : messageId;
}

async function selectReply(message) {
  if (message.deleted_at || sending.value) return;

  replyingTo.value = {
    message_id: message.message_id,
    username: message.username,
    content: message.content,
  };

  openMenuId.value = null;
  sendError.value = '';

  await nextTick();
  draftInput.value?.focus();
}

async function sendMessage() {
  const content = draft.value.trim();
  if (!content || sending.value) return;

  sending.value = true;
  sendError.value = '';
  openMenuId.value = null;

  try {
    const response = await fetch(
      `/api/rooms/${props.roomId}/messages`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          reply_to_message_id: replyingTo.value?.message_id ?? null,
        }),
      },
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      sendError.value = data.error || 'Could not send your message.';
      return;
    }

    draft.value = '';
    replyingTo.value = null;
    contextMessageId.value = null;
    jumpError.value = '';

    await loadMessages();
  } catch {
    sendError.value =
      'Could not confirm the send. Check the room before retrying.';
  } finally {
    sending.value = false;
  }
}

function messageElementId(messageId) {
  return `room-${props.roomId}-message-${messageId}`;
}

async function jumpToMessage(messageId) {
  if (jumping.value) return;

  jumping.value = true;
  jumpError.value = '';
  openMenuId.value = null;

  try {
    const response = await fetch(
      `/api/rooms/${props.roomId}/messages/${messageId}/context`,
      { credentials: 'include' },
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      jumpError.value = data.error || 'Could not find the original message.';
      return;
    }

    const history = await response.json();
    const original = history.find(
      message => message.message_id === messageId,
    );

    if (!original || original.deleted_at) {
      jumpError.value = 'Original message deleted or unavailable.';
      return;
    }

    contextMessageId.value = messageId;
    messages.value = history;

    await nextTick();

    const element = document.getElementById(messageElementId(messageId));

    if (element) {
      element.focus({ preventScroll: true });
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });

      element.animate(
        [
          { backgroundColor: 'rgba(129, 140, 248, 0.4)' },
          { backgroundColor: 'transparent' },
        ],
        { duration: 1800 },
      );
    }
  } catch (err) {
    console.error('Could not jump to message:', err);
    jumpError.value = 'Could not load the original message. Try again.';
  } finally {
    jumping.value = false;
  }
}

function returnToLatest() {
  contextMessageId.value = null;
  jumpError.value = '';
  loadMessages();
}

let socket;

onMounted(() => {
  loadMessages();

  socket = io({
    withCredentials: true,
    auth: { roomId: props.roomId },
  });

  socket.on('room:ready', loadMessages);
  socket.on('messages:changed', loadMessages);

  socket.on('connect_error', err => {
    console.error('Chat socket could not connect:', err.message);
  });
});

onUnmounted(() => {
  socket?.disconnect();
});
</script>

<template>
  <section @keydown.esc="openMenuId = null">
    <h2>{{ props.title }}</h2>

    <button
      v-if="contextMessageId"
      type="button"
      :disabled="jumping"
      @click="returnToLatest"
    >
      Back to latest messages
    </button>

    <p v-if="jumpError" role="alert">{{ jumpError }}</p>

    <p v-if="loading">Loading messages…</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <p v-else-if="messages.length === 0">No messages yet.</p>

    <ul v-else>
      <li
        v-for="message in messages"
        :key="message.message_id"
        :id="messageElementId(message.message_id)"
        tabindex="-1"
      >
        <header>
          <div>
            <img
              v-if="message.avatar"
              :src="message.avatar"
              alt=""
              width="32"
              height="32"
              referrerpolicy="no-referrer"
            />
            <strong>{{ message.username }}</strong>
          </div>

          <div v-if="!message.deleted_at">
            <button
              type="button"
              :aria-expanded="openMenuId === message.message_id"
              aria-label="Message options"
              @click="toggleMenu(message.message_id)"
            >
              ⋯
            </button>

            <div v-if="openMenuId === message.message_id">
              <button
                type="button"
                :disabled="sending"
                @click="selectReply(message)"
              >
                Reply
              </button>
            </div>
          </div>
        </header>

        <p v-if="message.deleted_at">
          Original message deleted
        </p>

        <template v-else>
          <blockquote v-if="message.reply">
            <span v-if="message.reply.deleted_at">
              Original message deleted
            </span>

            <button
              v-else
              type="button"
              :disabled="jumping"
              :aria-label="`Jump to original message by ${message.reply.username}`"
              @click="jumpToMessage(message.reply.message_id)"
            >
              <strong>{{ message.reply.username }}</strong>
              <span> — {{ message.reply.content }}</span>
            </button>
          </blockquote>

          <p>{{ message.content }}</p>
        </template>

        <time :datetime="message.created_at">
          {{ formatDate(message.created_at) }}
        </time>
      </li>
    </ul>

    <form
      v-if="!loading && !error"
      @submit.prevent="sendMessage"
    >
      <div v-if="replyingTo">
        <strong>Replying to {{ replyingTo.username }}</strong>
        <p>{{ replyingTo.content?.slice(0, 150) }}</p>

        <button
          type="button"
          aria-label="Cancel reply"
          :disabled="sending"
          @click="replyingTo = null"
        >
          ✕
        </button>
      </div>

      <label for="message-draft">Message</label>

      <input
        id="message-draft"
        ref="draftInput"
        v-model="draft"
        :disabled="sending"
        autocomplete="off"
      />

      <button type="submit" :disabled="sending || !draft.trim()">
        {{ sending ? 'Sending…' : 'Send' }}
      </button>

      <p v-if="sendError" role="alert">{{ sendError }}</p>
    </form>
  </section>
</template>