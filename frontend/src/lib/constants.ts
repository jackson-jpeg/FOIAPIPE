import {
  LayoutDashboard,
  Newspaper,
  FileText,
  Video,
  BarChart3,
  Settings,
  Building2,
  History,
  type LucideIcon,
} from 'lucide-react';

export const INCIDENT_TYPES = {
  ois: { label: 'Officer-Involved Shooting', color: '#ef4444', variant: 'danger' },
  use_of_force: { label: 'Use of Force', color: '#f59e0b', variant: 'warning' },
  pursuit: { label: 'Pursuit', color: '#f59e0b', variant: 'warning' },
  taser: { label: 'Taser', color: '#a855f7', variant: 'purple' },
  k9: { label: 'K-9', color: '#a855f7', variant: 'purple' },
  arrest: { label: 'Arrest', color: '#60a5fa', variant: 'info' },
  dui: { label: 'DUI', color: '#60a5fa', variant: 'info' },
  other: { label: 'Other', color: '#64748b', variant: 'default' },
} as const;

export const FOIA_STATUSES: Record<string, { label: string; color: string; variant: string }> = {
  draft: { label: 'Draft', color: '#64748b', variant: 'default' },
  ready: { label: 'Ready', color: '#94a3b8', variant: 'default' },
  submitted: { label: 'Submitted', color: '#60a5fa', variant: 'info' },
  acknowledged: { label: 'Acknowledged', color: '#3b82f6', variant: 'info' },
  processing: { label: 'Processing', color: '#a855f7', variant: 'purple' },
  fulfilled: { label: 'Fulfilled', color: '#22c55e', variant: 'success' },
  partial: { label: 'Partial', color: '#f59e0b', variant: 'warning' },
  denied: { label: 'Denied', color: '#ef4444', variant: 'danger' },
  appealed: { label: 'Appealed', color: '#f59e0b', variant: 'warning' },
  closed: { label: 'Closed', color: '#64748b', variant: 'default' },
};

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'default';

export const VIDEO_STATUSES: Record<string, { label: string; color: string; variant: BadgeVariant }> = {
  raw_received: { label: 'Raw Received', color: '#64748b', variant: 'default' },
  editing: { label: 'Editing', color: '#f59e0b', variant: 'warning' },
  ai_processing: { label: 'AI Processing', color: '#a855f7', variant: 'purple' },
  review: { label: 'Review', color: '#3b82f6', variant: 'info' },
  ready: { label: 'Ready', color: '#60a5fa', variant: 'info' },
  uploading: { label: 'Uploading', color: '#f59e0b', variant: 'warning' },
  published: { label: 'Published', color: '#22c55e', variant: 'success' },
  archived: { label: 'Archived', color: '#64748b', variant: 'default' },
};

export const SEVERITY_COLORS = {
  high: 'accent-red',
  medium: 'accent-amber',
  low: 'accent-green',
} as const;

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'News Scanner', path: '/news', icon: Newspaper },
  { label: 'FOIA Tracker', path: '/foia', icon: FileText },
  { label: 'Agencies', path: '/agencies', icon: Building2 },
  { label: 'Video Pipeline', path: '/videos', icon: Video },
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { label: 'Audit Log', path: '/audit', icon: History },
  { label: 'Settings', path: '/settings', icon: Settings },
];
