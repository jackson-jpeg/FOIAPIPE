import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  padding?: boolean;
  variant?: 'default' | 'elevated' | 'subtle';
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
        'rounded-lg transition-all duration-200',
        variant === 'default' && 'glass-2',
        variant === 'elevated' && 'glass-3',
        variant === 'subtle' && 'glass-1',
        hover && 'hover:border-glass-border-hover cursor-pointer',
        className
      )}
    >
      {title && (
        <div className="flex items-center justify-between px-4 py-3 border-b glass-border">
          <h3 className="text-2xs font-medium uppercase tracking-wider text-text-tertiary">{title}</h3>
          {action}
        </div>
      )}
      <div className={cn(padding && 'p-4')}>{children}</div>
      {footer && (
        <div className="border-t glass-border px-4 py-3">{footer}</div>
      )}
    </div>
  );
}
