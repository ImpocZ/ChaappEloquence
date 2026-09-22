<script setup>
  import { ref } from 'vue'
  const openAuthentizationGoogle = () => {

  }
  const openAuthentizationDiscord = () => {
    
  }
</script>
<template>
  <div class="flex flex-col gap-3">
    <h2 class="text-white text-center mb-2">Sign In</h2>
    <button class="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700" @click="openAuthentizationGoogle">
      Continue with Google
    </button>
    <button class="w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700" @click="openAuthentizationDiscord">
      Continue with Discord
    </button>
  </div>
</template>