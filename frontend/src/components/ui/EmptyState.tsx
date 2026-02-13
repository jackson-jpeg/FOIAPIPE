import { type ReactNode } from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="glass-1 rounded-lg p-8 text-center">
      {icon && (
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-accent-primary/10 text-accent-primary mb-3">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-text-primary mb-1">{title}</h3>
      <p className="max-w-md mx-auto text-2xs text-text-secondary leading-relaxed">{message}</p>
      {action && (
        <div className="mt-4">
          <Button variant="primary" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
