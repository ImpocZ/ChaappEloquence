<script setup>
function openAuthenticationGithub() {
  window.location.href = 'http://localhost:3001/auth/github';
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <h2 class="text-white text-center mb-2">Sign In</h2>

    <button
      type="button"
      class="w-full py-2 bg-gray-600 text-white rounded hover:bg-yellow-700"
      @click="openAuthenticationGithub"
    >
      Continue with GitHub
    </button>
  </div>
</template>