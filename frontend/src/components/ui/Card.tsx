import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  padding?: boolean;
  variant?: 'default' | 'gradient' | 'glass'; // Visual variants for personality
  hover?: boolean; // Enable hover lift effect
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
        'rounded-xl transition-all duration-200',
        // Variant styles - no borders, depth through shadows
        variant === 'default' && 'bg-surface-secondary shadow-card',
        variant === 'gradient' && 'gradient-soft shadow-card',
        variant === 'glass' && 'glass-surface shadow-card',
        // Hover effect
        hover && 'hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer',
        className
      )}
    >
      {title && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border/30">
          <h3 className="text-sm font-medium text-text-primary tracking-tight">{title}</h3>
          {action}
        </div>
      )}
      <div className={cn(padding && 'p-6')}>{children}</div>
      {footer && (
        <div className="border-t border-surface-border/30 px-6 py-4">{footer}</div>
      )}
    </div>
  );
}
