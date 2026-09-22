<script setup>
  import { ref } from 'vue'
  import Authentication from '../composables/Authentication.vue'

  const showAuth = ref(false)

  const openAuthentication = () => {
    showAuth.value = true
  }
</script>

<template>
  <header>
    <div class="flex justify-center gap-4 mb-4">
      <a href="/about" class="text-sm text-gray-400 hover:text-white">About</a>
      <a href="/support" class="text-sm text-gray-400 hover:text-white">Support</a>
      <a href="/privacy" class="text-sm text-gray-400 hover:text-white">Terms and Conditions</a>
    </div>
    <h1>Chaap-Eloquence</h1>
  </header>
  <main>
    <button id="ChaapButton" @click="openAuthentication">Into The Underworld</button>
  </main>
  <footer>&copy; 2026 Chaap-Eloquence. All rights reserved.</footer>

  <!-- Modal overlay -->
  <Teleport to="body">
    <div v-if="showAuth" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div class="bg-gray-900 rounded-lg p-6 w-80 relative">
        <button @click="showAuth = false" class="absolute top-2 right-3 text-gray-400 hover:text-white">✕</button>
        <Authentication />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
  

</style>