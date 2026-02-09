import { type ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Skeleton } from './Skeleton';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => ReactNode;
  width?: string; // Optional column width (e.g., "w-12", "w-1/4")
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  onRowClick?: (item: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  striped?: boolean; // Add striped row backgrounds
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  sortKey,
  sortDirection,
  onSort,
  onRowClick,
  loading = false,
  emptyMessage = 'No data available',
  striped = false,
}: TableProps<T>) {
  const renderSortIcon = (column: Column<T>) => {
    if (!column.sortable) return null;

    if (sortKey === column.key) {
      return sortDirection === 'asc' ? (
        <ChevronUp className="h-3 w-3" />
      ) : (
        <ChevronDown className="h-3 w-3" />
      );
    }
    return <ChevronsUpDown className="h-3 w-3 text-text-quaternary" />;
  };

  if (loading) {
    return (
      <div className="overflow-x-auto rounded-xl border border-surface-border shadow-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-border bg-surface-tertiary/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-text-tertiary',
                    col.width
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-surface-border/30">
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-4', col.width)}>
                    <Skeleton variant="text" className="h-3.5 w-3/4" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-surface-border py-16 text-text-tertiary">
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-surface-border shadow-card">
      <table className="w-full">
        <thead>
          <tr className="border-b border-surface-border bg-surface-tertiary/50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-2.5 text-left text-2xs font-medium text-text-tertiary',
                  col.sortable && 'cursor-pointer select-none transition-colors hover:text-text-secondary'
                )}
                onClick={() => col.sortable && onSort?.(col.key)}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {renderSortIcon(col)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr
              key={idx}
              className={cn(
                'border-b border-surface-border/30 transition-colors',
                striped && idx % 2 === 1 && 'bg-surface-tertiary/30',
                onRowClick && 'cursor-pointer hover:bg-surface-hover'
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className="px-4 py-2.5 text-sm text-text-secondary"
                  onClick={() => onRowClick?.(item)}
                >
                  {col.render ? col.render(item) : (item[col.key] as ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
