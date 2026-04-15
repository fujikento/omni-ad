import { memo } from 'react';
import { Award, ChevronRight, Pause, Play, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { translateVariantName, type ABTest } from '../_types';
import { MetricBadge, MiniProgressBar, SignificanceCell, StatusBadge, TypeBadge } from './Badges';

interface TestTableRowProps {
  test: ABTest;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpenDetail: (test: ABTest) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onDeclareWinner: (id: string) => void;
}

const TestTableRow = memo(function TestTableRow({
  test,
  selected,
  onToggleSelect,
  onOpenDetail,
  onPause,
  onResume,
  onDeclareWinner,
}: TestTableRowProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <tr
      className={cn(
        'border-b border-border transition-colors hover:bg-muted/20',
        selected && 'bg-primary/5',
      )}
    >
      <td className="px-3 py-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(test.id)}
          className="h-4 w-4 rounded border-input accent-primary"
          aria-label={t('abTests.selectTest', { name: test.name })}
        />
      </td>
      <td className="px-3 py-2.5">
        <button
          type="button"
          onClick={() => onOpenDetail(test)}
          className="text-left hover:underline"
        >
          <span className="font-medium text-foreground">{test.name}</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">{test.campaignName}</span>
        </button>
      </td>
      <td className="px-3 py-2.5">
        <TypeBadge testType={test.testType} />
      </td>
      <td className="px-3 py-2.5">
        <MetricBadge metric={test.metric} />
      </td>
      <td className="px-3 py-2.5 text-center text-foreground">
        {test.variantCount}
      </td>
      <td className="px-3 py-2.5">
        <MiniProgressBar current={test.currentSamples} total={test.requiredSamples} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <SignificanceCell significance={test.significance} />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          {test.lift > 0 && <Trophy size={12} className="text-success" />}
          <span className="text-sm text-foreground">{translateVariantName(test.bestVariant, t)}</span>
          <span className={cn(
            'text-xs font-semibold',
            test.lift > 0 ? 'text-success' : test.lift < 0 ? 'text-destructive' : 'text-muted-foreground',
          )}>
            {test.lift > 0 ? '+' : ''}{test.lift.toFixed(1)}%
          </span>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge status={test.status} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onOpenDetail(test)}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={t('abTests.actionDetail')}
            title={t('abTests.actionDetail')}
          >
            <ChevronRight size={14} />
          </button>
          {test.status === 'running' && (
            <button
              type="button"
              onClick={() => onPause(test.id)}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={t('abTests.actionPause')}
              title={t('abTests.actionPause')}
            >
              <Pause size={14} />
            </button>
          )}
          {test.status === 'paused' && (
            <button
              type="button"
              onClick={() => onResume(test.id)}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={t('abTests.actionResume')}
              title={t('abTests.actionResume')}
            >
              <Play size={14} />
            </button>
          )}
          {test.status === 'running' && test.significance >= 95 && (
            <button
              type="button"
              onClick={() => onDeclareWinner(test.id)}
              className="rounded p-1 text-success transition-colors hover:bg-success/10"
              aria-label={t('abTests.actionDeclareWinner')}
              title={t('abTests.actionDeclareWinner')}
            >
              <Award size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

interface TestTableProps {
  tests: ABTest[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onOpenDetail: (test: ABTest) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onDeclareWinner: (id: string) => void;
}

function TestTableInner({
  tests,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onOpenDetail,
  onPause,
  onResume,
  onDeclareWinner,
}: TestTableProps): React.ReactElement {
  const { t } = useI18n();
  const allSelected = tests.length > 0 && tests.every((t) => selectedIds.has(t.id));
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="w-10 px-3 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                className="h-4 w-4 rounded border-input accent-primary"
                aria-label={t('abTests.selectAll')}
              />
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">{t('abTests.tableTestName')}</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">{t('abTests.tableType')}</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">{t('abTests.tableMetric')}</th>
            <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground">{t('abTests.tableVariants')}</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">{t('abTests.tableSamples')}</th>
            <th className="px-3 py-3 text-right text-xs font-medium text-muted-foreground">{t('abTests.tableSignificance')}</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">{t('abTests.tableBestVariant')}</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">{t('abTests.tableStatus')}</th>
            <th className="px-3 py-3 text-right text-xs font-medium text-muted-foreground">{t('abTests.tableAction')}</th>
          </tr>
        </thead>
        <tbody>
          {tests.map((test) => (
            <TestTableRow
              key={test.id}
              test={test}
              selected={selectedIds.has(test.id)}
              onToggleSelect={onToggleSelect}
              onOpenDetail={onOpenDetail}
              onPause={onPause}
              onResume={onResume}
              onDeclareWinner={onDeclareWinner}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const TestTable = memo(TestTableInner);
