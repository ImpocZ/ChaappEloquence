<script setup>
import { ref } from 'vue';

const emit = defineEmits(['saved']);
const username = ref('');
const saving = ref(false);
const error = ref('');

async function saveUsername() {
  saving.value = true;
  error.value = '';

  try {
    const response = await fetch('http://localhost:3001/api/me/username', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value }),
    });

    const data = await response.json();

    if (!response.ok) {
      error.value = data.error || 'Could not save your nickname.';
      return;
    }

    emit('saved', data.username);
  } catch {
    error.value = 'Could not reach the server. Try again.';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section role="dialog" aria-labelledby="choose-username-title">
    <h2 id="choose-username-title">Choose your nickname</h2>

    <form @submit.prevent="saveUsername">
      <label for="username">Nickname</label>
      <input id="username" v-model.trim="username" required maxlength="30" />

      <p v-if="error" role="alert">{{ error }}</p>

      <button type="submit" :disabled="saving">
        {{ saving ? 'Saving…' : 'Continue to chat' }}
      </button>
    </form>
  </section>
</template>