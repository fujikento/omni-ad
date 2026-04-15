import { memo } from 'react';
import { ArrowRight, ChevronDown, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import {
  ACTION_TYPE_LABEL_KEYS,
  type ActionType,
  type AdjustDirection,
  type AdjustMethod,
  type NotificationChannel,
} from '../_types';
import { buildActionPreview, type FormAction } from './formState';

interface ActionEditorProps {
  actions: FormAction[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: <K extends keyof FormAction>(index: number, field: K, value: FormAction[K]) => void;
  onToggleChannel: (actIdx: number, channel: NotificationChannel) => void;
}

function ActionEditorInner({ actions, onAdd, onRemove, onUpdate, onToggleChannel }: ActionEditorProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <p className="text-sm font-medium text-foreground">{t('autoRules.actionSettings')}</p>
      <div className="space-y-4">
        {actions.map((act, idx) => (
          <div key={idx} className="rounded-md border border-border p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">{t('autoRules.actionN', { n: idx + 1 })}</span>
              {actions.length > 1 && (
                <button type="button" onClick={() => onRemove(idx)} className="rounded p-0.5 text-muted-foreground hover:text-red-600" aria-label={t('autoRules.removeAction')}>
                  <Minus size={14} />
                </button>
              )}
            </div>

            <div className="relative mt-2">
              <select
                value={act.type}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onUpdate(idx, 'type', e.target.value as ActionType)}
                className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label={t('autoRules.actionType')}
              >
                {(Object.entries(ACTION_TYPE_LABEL_KEYS) as [ActionType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{t(v)}</option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>

            {act.type === 'adjust_budget' && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="relative">
                  <select
                    value={act.adjustmentType}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onUpdate(idx, 'adjustmentType', e.target.value as AdjustMethod)}
                    className="w-full appearance-none rounded-md border border-input bg-background px-2 py-1.5 pr-6 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label={t('autoRules.adjustMethod')}
                  >
                    <option value="percent">{t('autoRules.adjustPercent')}</option>
                    <option value="absolute">{t('autoRules.adjustAbsolute')}</option>
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
                <input
                  type="number"
                  value={act.value}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(idx, 'value', e.target.value)}
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="20"
                  aria-label={t('autoRules.adjustValue')}
                />
                <div className="relative">
                  <select
                    value={act.direction}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onUpdate(idx, 'direction', e.target.value as AdjustDirection)}
                    className="w-full appearance-none rounded-md border border-input bg-background px-2 py-1.5 pr-6 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label={t('autoRules.adjustDirection')}
                  >
                    <option value="increase">{t('autoRules.increase')}</option>
                    <option value="decrease">{t('autoRules.decrease')}</option>
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            )}

            {act.type === 'adjust_bid' && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={act.value}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(idx, 'value', e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="10"
                    aria-label={t('autoRules.adjustRate')}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <div className="relative">
                  <select
                    value={act.direction}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onUpdate(idx, 'direction', e.target.value as AdjustDirection)}
                    className="w-full appearance-none rounded-md border border-input bg-background px-2 py-1.5 pr-6 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label={t('autoRules.adjustDirection')}
                  >
                    <option value="increase">{t('autoRules.bidIncrease')}</option>
                    <option value="decrease">{t('autoRules.bidDecrease')}</option>
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            )}

            {act.type === 'send_notification' && (
              <div className="mt-3 space-y-3">
                <div>
                  <span className="text-xs text-muted-foreground">{t('autoRules.channel')}</span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {(['dashboard', 'slack', 'line', 'email'] as const).map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => onToggleChannel(idx, ch)}
                        className={cn(
                          'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                          act.channels.includes(ch)
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/50',
                        )}
                      >
                        {ch === 'dashboard' ? t('autoRules.channelDashboard') : ch === 'slack' ? 'Slack' : ch === 'line' ? 'LINE' : t('autoRules.channelEmail')}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor={`notif-msg-${idx}`} className="text-xs text-muted-foreground">
                    {t('autoRules.messageTemplate')}
                  </label>
                  <textarea
                    id={`notif-msg-${idx}`}
                    value={act.message}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdate(idx, 'message', e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    rows={2}
                    placeholder={t('autoRules.messagePlaceholder')}
                  />
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
        {t('autoRules.addAction')}
      </button>

      <div className="rounded-md bg-primary/5 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('autoRules.preview')}</p>
        <p className="mt-1 text-xs text-foreground">
          <ArrowRight size={12} className="mr-1 inline text-primary" />
          {buildActionPreview(actions, t) || t('autoRules.noAction')}
        </p>
      </div>
    </div>
  );
}

export const ActionEditor = memo(ActionEditorInner);
