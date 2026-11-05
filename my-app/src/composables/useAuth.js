import { ref, onMounted } from 'vue';

export function useAuth() {
  const user = ref(null);
  const loading = ref(true);
  const error = ref(null);

  onMounted(async () => {
    try {
      const res = await fetch('http://localhost:3001/api/me', {
        credentials: 'include',
      });

      if (res.status === 401) {
        return;
      }

      if (!res.ok) {
        throw new Error(`Session check failed (${res.status})`);
      }

      user.value = await res.json();
    } catch (err) {
      console.error('Could not check the session:', err);
      error.value = 'Could not check your sign-in status.';
    } finally {
      loading.value = false;
    }
  });

  return { user, loading, error };
}