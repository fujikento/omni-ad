import { type ReactNode, type Key } from 'react';
import { cn } from '../utils.js';

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  /** Renders cell content for a row. */
  cell: (row: T, index: number) => ReactNode;
  /** Tailwind class for alignment / width. */
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => Key;
  emptyState?: ReactNode;
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  className?: string;
  /** Column count used to render skeleton rows when loading. */
  loadingRowCount?: number;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyState,
  isLoading = false,
  onRowClick,
  className,
  loadingRowCount = 6,
}: DataTableProps<T>): React.ReactElement {
  const showEmpty = !isLoading && rows.length === 0;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-card shadow-xs',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/40">
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    'px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground',
                    col.headerClassName,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: loadingRowCount }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="border-b border-border last:border-b-0">
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3', col.className)}>
                      <div className="h-3.5 w-full max-w-[140px] animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : showEmpty ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  {emptyState ?? 'データがありません'}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={rowKey(row, index)}
                  className={cn(
                    'border-b border-border transition-colors last:border-b-0',
                    onRowClick && 'cursor-pointer hover:bg-muted/40',
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3 text-sm text-foreground',
                        col.className,
                      )}
                    >
                      {col.cell(row, index)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
