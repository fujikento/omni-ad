'use client';

import { memo } from 'react';
import { Check, Pause, Play, Trash2, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface BulkActionBarProps {
  selectedCount: number;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
  onDeselect: () => void;
}

function BulkActionBarImpl({
  selectedCount,
  onPause,
  onResume,
  onDelete,
  onDeselect,
}: BulkActionBarProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="fixed inset-x-0 bottom-8 z-40 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar p-1.5 pl-4 text-sidebar-foreground shadow-lg animate-slide-up">
        <div className="flex items-center gap-2 pr-1">
          <span className="grid h-5 w-5 place-items-center rounded bg-primary text-[11px] font-semibold text-primary-foreground tabular-nums">
            <Check size={11} strokeWidth={3} />
          </span>
          <span className="text-sm font-medium text-white">
            {t('campaigns.selectedBulkCount', { count: selectedCount })}
          </span>
        </div>
        <div className="h-5 w-px bg-white/10" />
        <button
          type="button"
          onClick={onPause}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Pause size={12} />
          {t('campaigns.bulkPause')}
        </button>
        <button
          type="button"
          onClick={onResume}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Play size={12} />
          {t('campaigns.bulkResume')}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-destructive"
        >
          <Trash2 size={12} />
          {t('campaigns.bulkDelete')}
        </button>
        <div className="h-5 w-px bg-white/10" />
        <button
          type="button"
          onClick={onDeselect}
          aria-label={t('campaigns.deselect')}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export const BulkActionBar = memo(BulkActionBarImpl);
