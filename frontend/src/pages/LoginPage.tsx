import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Parked (2026-11-19): the backend (Railway app and database) is gone, so a sign-in cannot work.
 * The page asks the API's health check first and shows "Parked. Back later." when it does not
 * answer, instead of a form that can only fail. A running backend brings the form back by itself.
 */
type Backend = 'checking' | 'up' | 'down';

async function probeBackend(): Promise<Backend> {
  try {
    const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(6000) });
    return r.ok ? 'up' : 'down';
  } catch {
    return 'down';
  }
}

export function LoginPage() {
  const [backend, setBackend] = useState<Backend>('checking');
  useEffect(() => {
    let live = true;
    probeBackend().then((b) => live && setBackend(b));
    return () => {
      live = false;
    };
  }, []);
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
      navigate('/dashboard', { replace: true });
    } catch {
      // Error is handled by the store
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-primary p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-6 text-center">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-primary" />
            <h1 className="text-sm font-semibold text-text-primary tracking-[0.25em]">
              FOIA ARCHIVE
            </h1>
          </div>
        </div>

        {backend === 'down' && (
          <div className="glass-3 rounded-xl p-6 text-center" data-testid="parked">
            <p className="text-sm text-text-primary">Parked. Back later.</p>
          </div>
        )}

        {backend === 'checking' && <div className="glass-3 rounded-xl p-6" aria-busy="true" />}

        {backend === 'up' && (
        <div className="glass-3 rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              label="Username"
              type="text"
              placeholder="admin"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) clearError();
              }}
              disabled={isLoading}
            />

            <Input
              label="Password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) clearError();
              }}
              disabled={isLoading}
            />

            {error && (
              <div className="rounded-md bg-red-500/6 px-3 py-2 text-2xs text-red-400">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              loading={isLoading}
              disabled={!username || !password}
            >
              Sign In
            </Button>
          </form>
        </div>
        )}

        <p className="mt-4 text-center text-3xs text-text-quaternary">
          Internal tool &middot; Authorized access only &middot;{' '}
          <a href="/privacy.html" className="underline">
            Privacy
          </a>
        </p>
      </div>
    </div>
  );
}
