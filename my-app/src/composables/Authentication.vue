<script setup>
  import { ref } from 'vue'
  const openAuthenticationGoogle = () => {

  }
  const openAuthenticationDiscord = () => {

  }
  const openAuthenticationGithub = () => {

  }
</script>
<template>
  <div class="flex flex-col gap-3">
    <h2 class="text-white text-center mb-2">Sign In</h2>
    <button class="w-full py-2 bg-red-600 text-white rounded hover:bg-yellow-700" @click="openAuthenticationGoogle">
      Continue with Google
    </button>
    <button class="w-full py-2 bg-indigo-600 text-white rounded hover:bg-yellow-700" @click="openAuthenticationDiscord">
      Continue with Discord
    </button>
    <button class="w-full py-2 bg-gray-600 text-white rounded hover:bg-yellow-700" @click="openAuthenticationGithub">
      Continue with Github
    </button>
  </div>
</template>