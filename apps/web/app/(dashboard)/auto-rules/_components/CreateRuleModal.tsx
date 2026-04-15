import { memo, useCallback, useState } from 'react';
import { Check, ChevronDown, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { COOLDOWN_OPTIONS, type AutoRule, type NotificationChannel } from '../_types';
import {
  createEmptyAction,
  createEmptyCondition,
  type FormAction,
  type FormCondition,
} from './formState';
import { ConditionEditor } from './ConditionEditor';
import { ActionEditor } from './ActionEditor';

interface CreateRuleModalProps {
  open: boolean;
  onClose: () => void;
  editingRule?: AutoRule | null;
}

function CreateRuleModalInner({ open, onClose, editingRule }: CreateRuleModalProps): React.ReactElement | null {
  const { t } = useI18n();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState(editingRule?.name ?? '');
  const [cooldown, setCooldown] = useState(editingRule?.cooldownMinutes ?? 60);
  const [conditions, setConditions] = useState<FormCondition[]>([createEmptyCondition()]);
  const [actions, setActions] = useState<FormAction[]>([createEmptyAction()]);

  const addCondition = useCallback((): void => {
    setConditions((prev) => [...prev, createEmptyCondition()]);
  }, []);

  const removeCondition = useCallback((index: number): void => {
    setConditions((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const updateCondition = useCallback(<K extends keyof FormCondition>(index: number, field: K, value: FormCondition[K]): void => {
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }, []);

  const addAction = useCallback((): void => {
    setActions((prev) => [...prev, createEmptyAction()]);
  }, []);

  const removeAction = useCallback((index: number): void => {
    setActions((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const updateAction = useCallback(<K extends keyof FormAction>(index: number, field: K, value: FormAction[K]): void => {
    setActions((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  }, []);

  const toggleDay = useCallback((condIdx: number, day: number): void => {
    setConditions((prev) =>
      prev.map((c, i) => {
        if (i !== condIdx) return c;
        const days = c.dayOfWeek.includes(day)
          ? c.dayOfWeek.filter((d) => d !== day)
          : [...c.dayOfWeek, day];
        return { ...c, dayOfWeek: days };
      }),
    );
  }, []);

  const toggleChannel = useCallback((actIdx: number, channel: NotificationChannel): void => {
    setActions((prev) =>
      prev.map((a, i) => {
        if (i !== actIdx) return a;
        const channels = a.channels.includes(channel)
          ? a.channels.filter((c) => c !== channel)
          : [...a.channels, channel];
        return { ...a, channels };
      }),
    );
  }, []);

  const handleSubmit = useCallback((): void => {
    // In production, build the proper typed arrays from form state and call createMutation
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t('autoRules.modalTitle')}</h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn('rounded-full px-2 py-0.5 font-medium', step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                {t('autoRules.step1')}
              </span>
              <ChevronRight size={12} />
              <span className={cn('rounded-full px-2 py-0.5 font-medium', step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                {t('autoRules.step2')}
              </span>
              <ChevronRight size={12} />
              <span className={cn('rounded-full px-2 py-0.5 font-medium', step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                {t('autoRules.step3')}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label htmlFor="rule-name" className="mb-1 block text-sm font-medium text-foreground">
                  {t('autoRules.ruleName')}
                </label>
                <input
                  id="rule-name"
                  type="text"
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={t('autoRules.ruleNamePlaceholder')}
                  required
                />
              </div>
              <div>
                <label htmlFor="rule-cooldown" className="mb-1 block text-sm font-medium text-foreground">
                  {t('autoRules.cooldown')}
                </label>
                <div className="relative">
                  <select
                    id="rule-cooldown"
                    value={cooldown}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCooldown(Number(e.target.value))}
                    className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {COOLDOWN_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <ConditionEditor
              conditions={conditions}
              onAdd={addCondition}
              onRemove={removeCondition}
              onUpdate={updateCondition}
              onToggleDay={toggleDay}
            />
          )}

          {step === 3 && (
            <ActionEditor
              actions={actions}
              onAdd={addAction}
              onRemove={removeAction}
              onUpdate={updateAction}
              onToggleChannel={toggleChannel}
            />
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between border-t border-border bg-card px-6 py-4">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((step - 1) as 1 | 2 | 3)}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                {t('common.back')}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              {t('common.cancel')}
            </button>
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((step + 1) as 1 | 2 | 3)}
                disabled={step === 1 && !name}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {t('common.next')}
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Check size={14} />
                {t('autoRules.submitRule')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const CreateRuleModal = memo(CreateRuleModalInner);
