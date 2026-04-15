import { memo, useMemo } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

interface PaginationProps {
  total: number;
  currentPage: number;
  perPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}

function PaginationInner({
  total,
  currentPage,
  perPage,
  totalPages,
  onPageChange,
  onPerPageChange,
}: PaginationProps): React.ReactElement {
  const { t } = useI18n();

  const pageNumbers = useMemo(() => {
    return Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
      if (totalPages <= 5) return i + 1;
      if (currentPage <= 3) return i + 1;
      if (currentPage >= totalPages - 2) return totalPages - 4 + i;
      return currentPage - 2 + i;
    });
  }, [currentPage, totalPages]);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          {t('abTests.paginationShowing', {
            total: String(total),
            from: String((currentPage - 1) * perPage + 1),
            to: String(Math.min(currentPage * perPage, total)),
          })}
        </span>
        <div className="relative">
          <select
            value={perPage}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onPerPageChange(Number(e.target.value))}
            className="appearance-none rounded-md border border-input bg-background py-1 pl-2 pr-7 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label={t('abTests.paginationPerPage')}
          >
            <option value={20}>{t('abTests.paginationItems', { count: '20' })}</option>
            <option value={50}>{t('abTests.paginationItems', { count: '50' })}</option>
            <option value={100}>{t('abTests.paginationItems', { count: '100' })}</option>
          </select>
          <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
          aria-label={t('abTests.prevPage')}
        >
          <ChevronLeft size={16} />
        </button>
        {pageNumbers.map((pageNum) => (
          <button
            key={pageNum}
            type="button"
            onClick={() => onPageChange(pageNum)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors',
              currentPage === pageNum
                ? 'bg-primary text-primary-foreground'
                : 'border border-border text-foreground hover:bg-accent',
            )}
          >
            {pageNum}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
          aria-label={t('abTests.nextPage')}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export const Pagination = memo(PaginationInner);
