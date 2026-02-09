import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function useAuth() {
  const navigate = useNavigate();
  const { token, isAuthenticated, isLoading, error, login, logout, clearError } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return { token, isAuthenticated, isLoading, error, login, logout, clearError };
}
