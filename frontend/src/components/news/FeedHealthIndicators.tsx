import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/formatters';
import { Button } from '@/components/ui/Button';
import { getCircuitBreakers, resetCircuitBreaker, type CircuitBreaker } from '@/api/news';
import { useToast } from '@/components/ui/Toast';
import { RotateCcw } from 'lucide-react';

function statusColor(cb: CircuitBreaker): 'green' | 'yellow' | 'red' {
  if (cb.is_circuit_open) return 'red';
  if (cb.consecutive_failures > 0) return 'yellow';
  return 'green';
}

const dotClasses: Record<string, string> = {
  green: 'bg-accent-green',
  yellow: 'bg-accent-amber',
  red: 'bg-accent-red',
};

export function FeedHealthIndicators() {
  const [breakers, setBreakers] = useState<CircuitBreaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState<string | null>(null);
  const { addToast } = useToast();

  const fetchBreakers = () => {
    setLoading(true);
    getCircuitBreakers()
      .then((data) => setBreakers(data.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBreakers();
  }, []);

  const handleReset = async (sourceName: string) => {
    setResetting(sourceName);
    try {
      await resetCircuitBreaker(sourceName);
      addToast({ type: 'success', title: `Reset ${sourceName}` });
      fetchBreakers();
    } catch {
      addToast({ type: 'error', title: 'Reset failed' });
    } finally {
      setResetting(null);
    }
  };

  if (loading && breakers.length === 0) {
    return (
      <div className="glass-2 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Feed Health</h3>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 rounded-lg shimmer bg-surface-tertiary/40" />
          ))}
        </div>
      </div>
    );
  }

  if (breakers.length === 0) {
    return null;
  }

  return (
    <div className="glass-2 rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-glass-border">
        <h3 className="text-sm font-semibold text-text-primary">Feed Health</h3>
      </div>
      <div className="divide-y divide-glass-border">
        {breakers.map((cb) => {
          const color = statusColor(cb);
          return (
            <div key={cb.id} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-hover transition-colors">
              <span className={cn('h-2 w-2 rounded-full shrink-0', dotClasses[color])} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">{cb.source_name}</p>
                <p className="text-2xs text-text-tertiary">
                  {cb.last_success_at ? `Last OK: ${formatRelativeTime(cb.last_success_at)}` : 'Never succeeded'}
                  {cb.consecutive_failures > 0 && (
                    <span className="text-accent-red ml-2">
                      {cb.consecutive_failures} failure{cb.consecutive_failures > 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              </div>
              {cb.is_circuit_open && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReset(cb.source_name)}
                  loading={resetting === cb.source_name}
                  icon={<RotateCcw className="h-3 w-3" />}
                >
                  Reset
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
