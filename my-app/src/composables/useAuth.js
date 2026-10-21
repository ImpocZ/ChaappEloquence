import { ref, onMounted } from 'vue';

export function useAuth() {
  const user = ref(null);
  const loading = ref(true);
  console.log('useAuth called');

  onMounted(async () => {
    console.log('useAuth mounted');
    const res = await fetch('http://localhost:3001/api/me', { credentials: 'include' });
    if (res.ok) {
      user.value = await res.json();
    }
    loading.value = false;
  });

  return { user, loading };
}   