import { memo } from 'react';
import { ChevronDown, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import {
  CONDITION_TYPE_LABEL_KEYS,
  DAY_LABEL_KEYS,
  DURATION_LABEL_KEYS,
  METRIC_LABEL_KEYS,
  OPERATOR_LABELS,
  type ConditionType,
  type Duration,
  type MetricName,
  type Operator,
} from '../_types';
import { buildConditionPreview, type FormCondition } from './formState';

interface ConditionEditorProps {
  conditions: FormCondition[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: <K extends keyof FormCondition>(index: number, field: K, value: FormCondition[K]) => void;
  onToggleDay: (condIdx: number, day: number) => void;
}

function ConditionEditorInner({ conditions, onAdd, onRemove, onUpdate, onToggleDay }: ConditionEditorProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <p className="text-sm font-medium text-foreground">{t('autoRules.conditionSettings')}</p>
      <div className="space-y-4">
        {conditions.map((cond, idx) => (
          <div key={idx} className="rounded-md border border-border p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">{t('autoRules.conditionN', { n: idx + 1 })}</span>
              {conditions.length > 1 && (
                <button type="button" onClick={() => onRemove(idx)} className="rounded p-0.5 text-muted-foreground hover:text-red-600" aria-label={t('autoRules.removeCondition')}>
                  <Minus size={14} />
                </button>
              )}
            </div>

            <div className="relative mt-2">
              <select
                value={cond.type}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onUpdate(idx, 'type', e.target.value as ConditionType)}
                className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label={t('autoRules.conditionType')}
              >
                {(Object.entries(CONDITION_TYPE_LABEL_KEYS) as [ConditionType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{t(v)}</option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>

            {cond.type === 'metric_threshold' && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="relative">
                  <select
                    value={cond.metric}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onUpdate(idx, 'metric', e.target.value as MetricName)}
                    className="w-full appearance-none rounded-md border border-input bg-background px-2 py-1.5 pr-6 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label={t('autoRules.metricLabel')}
                  >
                    {(Object.entries(METRIC_LABEL_KEYS) as [MetricName, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v.startsWith('autoRules.') ? t(v) : v}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
                <div className="relative">
                  <select
                    value={cond.operator}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onUpdate(idx, 'operator', e.target.value as Operator)}
                    className="w-full appearance-none rounded-md border border-input bg-background px-2 py-1.5 pr-6 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label={t('autoRules.operatorLabel')}
                  >
                    {(Object.entries(OPERATOR_LABELS) as [Operator, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
                <input
                  type="number"
                  value={cond.value}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(idx, 'value', e.target.value)}
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={t('autoRules.valueLabel')}
                  aria-label={t('autoRules.thresholdLabel')}
                />
                <div className="relative">
                  <select
                    value={cond.duration}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onUpdate(idx, 'duration', e.target.value as Duration)}
                    className="w-full appearance-none rounded-md border border-input bg-background px-2 py-1.5 pr-6 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label={t('autoRules.durationLabel')}
                  >
                    {(Object.entries(DURATION_LABEL_KEYS) as [Duration, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{t(v)}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            )}

            {cond.type === 'budget_pacing' && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="relative">
                  <select
                    value={cond.pace}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onUpdate(idx, 'pace', e.target.value as 'over' | 'under')}
                    className="w-full appearance-none rounded-md border border-input bg-background px-3 py-1.5 pr-8 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label={t('autoRules.paceLabel')}
                  >
                    <option value="over">{t('autoRules.paceOver')}</option>
                    <option value="under">{t('autoRules.paceUnder')}</option>
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={cond.threshold}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(idx, 'threshold', e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="20"
                    aria-label={t('autoRules.thresholdPercent')}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
            )}

            {cond.type === 'creative_fatigue' && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">{t('autoRules.ctrDeclineRate')}</span>
                  <input
                    type="number"
                    value={cond.ctrDeclinePercent}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(idx, 'ctrDeclinePercent', e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="15"
                    aria-label={t('autoRules.ctrDeclineRate')}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">{t('autoRules.periodDays')}</span>
                  <input
                    type="number"
                    value={cond.days}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(idx, 'days', e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="5"
                    aria-label={t('autoRules.periodDays')}
                  />
                  <span className="text-xs text-muted-foreground">{t('autoRules.dayUnit')}</span>
                </div>
              </div>
            )}

            {cond.type === 'time_based' && (
              <div className="mt-3 space-y-3">
                <div>
                  <span className="text-xs text-muted-foreground">{t('autoRules.dayOfWeek')}</span>
                  <div className="mt-1 flex gap-1">
                    {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => onToggleDay(idx, day)}
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-colors',
                          cond.dayOfWeek.includes(day)
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-border text-muted-foreground hover:border-primary/50',
                        )}
                      >
                        {t(DAY_LABEL_KEYS[day] ?? '')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t('autoRules.timeRange')}</span>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={cond.hourStart}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(idx, 'hourStart', Number(e.target.value))}
                    className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label={t('autoRules.startTime')}
                  />
                  <span className="text-xs text-muted-foreground">:00 -</span>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={cond.hourEnd}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(idx, 'hourEnd', Number(e.target.value))}
                    className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label={t('autoRules.endTime')}
                  />
                  <span className="text-xs text-muted-foreground">:00</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
      >
        <Plus size={14} />
        {t('autoRules.addCondition')}
      </button>

      <div className="rounded-md bg-muted/50 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('autoRules.preview')}</p>
        <p className="mt-1 text-xs text-foreground">{buildConditionPreview(conditions, t) || t('autoRules.noCondition')}</p>
      </div>
    </div>
  );
}

export const ConditionEditor = memo(ConditionEditorInner);
