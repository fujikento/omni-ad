import { memo } from 'react';
import { ArrowRight, Copy, Trash2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import {
  COOLDOWN_OPTIONS,
  describeAction,
  describeCondition,
  getActionIcon,
  getConditionIcon,
  type AutoRule,
} from '../_types';

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (value: boolean) => void;
}

export const ToggleSwitch = memo(function ToggleSwitch({ enabled, onChange }: ToggleSwitchProps): React.ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        enabled ? 'bg-primary' : 'bg-muted-foreground/30',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-white transition-transform',
          enabled ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
});

interface RuleCardProps {
  rule: AutoRule;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

function RuleCardInner({ rule, onToggle, onEdit, onDuplicate, onDelete }: RuleCardProps): React.ReactElement {
  const { t } = useI18n();
  const cooldownOption = COOLDOWN_OPTIONS.find((o) => o.value === rule.cooldownMinutes);
  return (
    <div className={cn(
      'rounded-lg border bg-card p-5 transition-colors',
      rule.enabled ? 'border-border' : 'border-border opacity-60',
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <ToggleSwitch enabled={rule.enabled} onChange={(val) => onToggle(rule.id, val)} />
          <div>
            <h3 className="text-sm font-semibold text-foreground">{rule.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('autoRules.cooldown')}: {cooldownOption ? t(cooldownOption.labelKey) : `${rule.cooldownMinutes}${t('autoRules.minuteUnit')}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(rule.id)}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t('common.edit')}
            aria-label={`${rule.name}${t('common.edit')}`}
          >
            <Zap size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(rule.id)}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t('autoRules.duplicate')}
            aria-label={`${rule.name}${t('autoRules.duplicate')}`}
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(rule.id)}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950/30 dark:hover:text-red-400"
            title={t('common.delete')}
            aria-label={`${rule.name}${t('common.delete')}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('autoRules.conditionIf')}</p>
        {rule.conditions.map((condition, idx) => (
          <div key={idx} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5">
            <span className="flex-shrink-0 text-muted-foreground">{getConditionIcon(condition.type)}</span>
            <span className="text-xs text-foreground">{describeCondition(condition, t)}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('autoRules.actionThen')}</p>
        {rule.actions.map((action, idx) => (
          <div key={idx} className="flex items-center gap-2 rounded-md bg-primary/5 px-3 py-1.5">
            <ArrowRight size={12} className="flex-shrink-0 text-primary" />
            <span className="flex-shrink-0 text-primary">{getActionIcon(action.type)}</span>
            <span className="text-xs font-medium text-primary">{describeAction(action, t)}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
        <span>{t('autoRules.triggerCount')} <span className="font-semibold text-foreground">{t('autoRules.triggerUnit', { count: rule.triggerCount })}</span></span>
        {rule.lastTriggered && (
          <span>{t('autoRules.lastTriggered')}: <span className="font-medium text-foreground">{rule.lastTriggered}</span></span>
        )}
      </div>
    </div>
  );
}

export const RuleCard = memo(RuleCardInner);
