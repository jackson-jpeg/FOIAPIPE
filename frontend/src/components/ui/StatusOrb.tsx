import { cn } from '@/lib/cn';

type StatusOrbSize = 'sm' | 'md' | 'lg';
type StatusOrbColor = 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'default';

interface StatusOrbProps {
  size?: StatusOrbSize;
  color?: StatusOrbColor;
  label?: string;
  pulse?: boolean;
  className?: string;
}

const sizeStyles = {
  sm: 'h-1.5 w-1.5', // 6px
  md: 'h-2 w-2', // 8px
  lg: 'h-2.5 w-2.5', // 10px
};

const colorStyles = {
  success: 'bg-accent-green text-accent-green',
  warning: 'bg-accent-amber text-accent-amber',
  danger: 'bg-accent-red text-accent-red',
  info: 'bg-accent-blue text-accent-blue',
  purple: 'bg-accent-purple text-accent-purple',
  default: 'bg-text-tertiary text-text-tertiary',
};

export function StatusOrb({
  size = 'md',
  color = 'default',
  label,
  pulse = true,
  className,
}: StatusOrbProps) {
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <div
        className={cn(
          'rounded-full transition-colors duration-300',
          sizeStyles[size],
          colorStyles[color],
          pulse && 'animate-orb-pulse'
        )}
        role="status"
        aria-label={label || `Status: ${color}`}
      />
      {label && (
        <span className="text-sm text-text-secondary font-medium">
          {label}
        </span>
      )}
    </div>
  );
}
