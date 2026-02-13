import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-primary px-4">
      <div className="w-full max-w-md text-center">
        {/* 404 Illustration */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center">
            <span className="text-9xl font-bold text-text-primary opacity-10">404</span>
          </div>
        </div>

        {/* Content */}
        <div className="mb-8 space-y-3">
          <h1 className="text-display-sm font-semibold text-text-primary">
            Page Not Found
          </h1>
          <p className="text-base text-text-secondary">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            variant="primary"
            onClick={() => navigate('/dashboard')}
            icon={<Home className="h-4 w-4" />}
          >
            Go to Dashboard
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate(-1)}
            icon={<ArrowLeft className="h-4 w-4" />}
          >
            Go Back
          </Button>
        </div>

        {/* Helpful Links */}
        <div className="mt-12 border-t border-surface-border pt-8">
          <p className="mb-4 text-sm text-text-tertiary">
            Looking for something specific?
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <button
              onClick={() => navigate('/news')}
              className="text-text-secondary transition-colors hover:text-accent-primary"
            >
              News Scanner
            </button>
            <button
              onClick={() => navigate('/foia')}
              className="text-text-secondary transition-colors hover:text-accent-primary"
            >
              FOIA Tracker
            </button>
            <button
              onClick={() => navigate('/videos')}
              className="text-text-secondary transition-colors hover:text-accent-primary"
            >
              Videos
            </button>
            <button
              onClick={() => navigate('/analytics')}
              className="text-text-secondary transition-colors hover:text-accent-primary"
            >
              Analytics
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="text-text-secondary transition-colors hover:text-accent-primary"
            >
              Settings
            </button>
          </div>
        </div>

        {/* Search Hint */}
        <div className="mt-8 rounded-lg border border-glass-border bg-surface-secondary/30 p-4">
          <div className="flex items-center justify-center gap-2 text-sm text-text-tertiary">
            <Search className="h-4 w-4" />
            <span>
              Press <kbd className="rounded bg-surface-tertiary px-2 py-1 font-mono text-xs">⌘K</kbd> to search
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
