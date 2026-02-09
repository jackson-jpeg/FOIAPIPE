import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  padding?: boolean;
  glass?: boolean; // Glass variant for semi-transparent backdrop-blur panels
}

export function Card({ title, action, children, footer, className, padding = true, glass = false }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-surface-border shadow-card',
        glass ? 'glass-surface' : 'bg-surface-secondary',
        className
      )}
    >
      {title && (
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-4">
          <h3 className="text-base font-semibold text-text-primary tracking-tight">{title}</h3>
          {action}
        </div>
      )}
      <div className={cn(padding && 'p-6')}>{children}</div>
      {footer && (
        <div className="border-t border-surface-border px-6 py-4">{footer}</div>
      )}
    </div>
  );
}
