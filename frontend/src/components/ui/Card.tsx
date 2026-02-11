import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  padding?: boolean;
  variant?: 'default' | 'gradient' | 'glass';
  hover?: boolean;
}

export function Card({
  title,
  action,
  children,
  footer,
  className,
  padding = true,
  variant = 'default',
  hover = false
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-surface-border/50 transition-all duration-200',
        variant === 'default' && 'bg-surface-secondary',
        variant === 'gradient' && 'gradient-soft',
        variant === 'glass' && 'glass-surface',
        hover && 'hover:border-accent-primary/30 hover:-translate-y-0.5 cursor-pointer',
        className
      )}
    >
      {title && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border/50">
          <h3 className="text-sm font-medium text-text-primary tracking-tight">{title}</h3>
          {action}
        </div>
      )}
      <div className={cn(padding && 'p-6')}>{children}</div>
      {footer && (
        <div className="border-t border-surface-border/50 px-6 py-4">{footer}</div>
      )}
    </div>
  );
}
