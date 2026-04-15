import { memo } from 'react';
import { Pause, Play, Trash2, Trophy } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface BulkActionsBarProps {
  selectedCount: number;
  hasSignificantTests: boolean;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
  onDeclareWinners: () => void;
  onClearSelection: () => void;
}

function BulkActionsBarInner({
  selectedCount,
  hasSignificantTests,
  onPause,
  onResume,
  onDelete,
  onDeclareWinners,
  onClearSelection,
}: BulkActionsBarProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
      <span className="text-sm font-semibold text-foreground">{t('abTests.selectedCount', { count: String(selectedCount) })}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPause}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Pause size={12} />
          {t('abTests.bulkPause')}
        </button>
        <button
          type="button"
          onClick={onResume}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Play size={12} />
          {t('abTests.bulkResume')}
        </button>
        {hasSignificantTests && (
          <button
            type="button"
            onClick={onDeclareWinners}
            className="inline-flex items-center gap-1 rounded-md bg-success px-3 py-1.5 text-xs font-medium text-success-foreground transition-colors hover:bg-success/90"
          >
            <Trophy size={12} />
            {t('abTests.bulkDeclareWinners')}
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-card px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <Trash2 size={12} />
          {t('abTests.bulkDelete')}
        </button>
      </div>
      <button
        type="button"
        onClick={onClearSelection}
        className="ml-auto text-xs text-muted-foreground hover:text-foreground"
      >
        {t('abTests.deselect')}
      </button>
    </div>
  );
}

export const BulkActionsBar = memo(BulkActionsBarInner);
