import { StatusOrb } from '@/components/ui/StatusOrb';
import { FOIA_STATUSES } from '@/lib/constants';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const info = FOIA_STATUSES[status as keyof typeof FOIA_STATUSES];
  if (!info) return <StatusOrb color="default" size={size} label={status} />;
  return (
    <StatusOrb
      color={info.variant as 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'default'}
      size={size}
      label={info.label}
    />
  );
}
