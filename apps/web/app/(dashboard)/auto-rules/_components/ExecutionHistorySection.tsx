import { memo, useState } from 'react';
import { ChevronDown, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { EXECUTION_STATUS_KEYS, type ExecutionStatus, type RuleExecution } from '../_types';

const ExecutionStatusBadge = memo(function ExecutionStatusBadge({ status }: { status: ExecutionStatus }): React.ReactElement {
  const { t } = useI18n();
  const config = EXECUTION_STATUS_KEYS[status];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className)}>
      {t(config.labelKey)}
    </span>
  );
});

function ExecutionHistorySectionInner({ executions }: { executions: RuleExecution[] }): React.ReactElement {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 5;
  const totalPages = Math.ceil(executions.length / pageSize);
  const paged = executions.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-muted/30"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">{t('autoRules.executionHistory')}</h3>
          <span className="text-xs text-muted-foreground">{t('autoRules.executionCount', { count: executions.length })}</span>
        </div>
        <ChevronDown size={14} className={cn('text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="border-t border-border">
          {executions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Clock size={28} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('autoRules.execDatetime')}</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('autoRules.execRuleName')}</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('autoRules.execCampaign')}</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('autoRules.execConditionValue')}</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('autoRules.execAction')}</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('autoRules.execStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((exec) => (
                      <tr key={exec.id} className="border-b border-border transition-colors hover:bg-muted/30">
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{exec.datetime}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{exec.ruleName}</td>
                        <td className="px-4 py-3 text-foreground">{exec.campaignName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{exec.conditionValue}</td>
                        <td className="px-4 py-3 text-foreground">{exec.executedAction}</td>
                        <td className="px-4 py-3">
                          <ExecutionStatusBadge status={exec.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    {t('autoRules.paginationOf', { from: String(page * pageSize + 1), to: String(Math.min((page + 1) * pageSize, executions.length)), total: String(executions.length) })}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      {t('autoRules.paginationPrev')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      {t('autoRules.paginationNext')}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export const ExecutionHistorySection = memo(ExecutionHistorySectionInner);
