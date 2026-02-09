import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ title, children, footer, className, padding = true }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-surface-border bg-surface-secondary hover:shadow-lg hover:shadow-black/20 transition-shadow duration-200',
        className
      )}
    >
      {title && (
        <div className="border-b border-surface-border px-5 py-4">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        </div>
      )}
      <div className={cn(padding && 'p-5')}>{children}</div>
      {footer && (
        <div className="border-t border-surface-border px-5 py-3">{footer}</div>
      )}
    </div>
  );
}
