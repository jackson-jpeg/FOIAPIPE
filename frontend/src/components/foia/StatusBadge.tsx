import { Badge } from '@/components/ui/Badge';
import { FOIA_STATUSES } from '@/lib/constants';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const info = FOIA_STATUSES[status as keyof typeof FOIA_STATUSES];
  if (!info) return <Badge variant="default" size={size}>{status}</Badge>;
  return <Badge variant={info.variant as any} size={size} dot>{info.label}</Badge>;
}
