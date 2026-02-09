import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export function LoginPage() {
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
      <div className="w-full max-w-xs animate-fade-in">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full bg-accent-primary" />
            <h1 className="text-sm font-semibold text-text-primary tracking-widest">
              FOIAPIPE
            </h1>
          </div>
          <p className="text-2xs text-text-quaternary">
            Bodycam FOIA Pipeline
          </p>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-secondary p-5 shadow-card">
          <form onSubmit={handleSubmit} className="space-y-3.5">
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
              <div className="rounded-lg bg-accent-red-subtle border border-accent-red/10 px-3 py-2 text-2xs text-accent-red">
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

        <p className="mt-5 text-center text-2xs text-text-quaternary">
          Internal tool &middot; Authorized access only
        </p>
      </div>
    </div>
  );
}
