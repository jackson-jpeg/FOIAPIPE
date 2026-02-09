import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ title, action, children, footer, className, padding = true }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-surface-border bg-surface-secondary shadow-card',
        className
      )}
    >
      {title && (
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-3">
          <h3 className="text-sm font-medium text-text-primary tracking-tight">{title}</h3>
          {action}
        </div>
      )}
      <div className={cn(padding && 'p-5')}>{children}</div>
      {footer && (
        <div className="border-t border-surface-border px-5 py-3">{footer}</div>
      )}
    </div>
  );
}
