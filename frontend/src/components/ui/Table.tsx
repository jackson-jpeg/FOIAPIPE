import { type ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Skeleton } from './Skeleton';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => ReactNode;
  width?: string;
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
  striped?: boolean;
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
      <div className="overflow-hidden rounded-lg glass-2">
        <table className="w-full">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-3 py-1.5 text-left text-3xs font-medium uppercase tracking-widest text-text-quaternary',
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
              <tr key={i} className="border-t border-glass-border">
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-3 py-1.5', col.width)}>
                    <Skeleton variant="text" className="h-3 w-3/4" />
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
      <div className="flex items-center justify-center rounded-lg glass-2 py-12 text-text-tertiary">
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg glass-2">
      <table className="w-full">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-3 py-1.5 text-left text-3xs font-medium uppercase tracking-widest text-text-quaternary',
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
                'transition-colors border-t border-glass-border',
                striped && idx % 2 === 1 && 'bg-glass-highlight',
                onRowClick && 'cursor-pointer hover:bg-glass-highlight'
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className="px-3 py-1.5 text-sm text-text-primary"
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
