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
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {icon && (
        <div className="mb-4 text-text-quaternary">{icon}</div>
      )}
      <h3 className="text-sm font-medium text-text-secondary">{title}</h3>
      <p className="mt-1 max-w-xs text-xs text-text-tertiary leading-relaxed">{message}</p>
      {action && (
        <div className="mt-5">
          <Button variant="outline" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
