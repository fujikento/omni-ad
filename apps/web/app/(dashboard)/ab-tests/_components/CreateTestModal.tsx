import { memo, useCallback, useMemo, useState } from 'react';
import { ChevronDown, Minus, Plus, Settings2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import {
  METRIC_CONFIG,
  TEST_TYPE_CONFIG,
  TRAFFIC_OPTIONS,
  getCampaignOptions,
  type CreateFormVariant,
  type MetricType,
  type TestType,
  type TrafficAllocation,
} from '../_types';

interface CreateTestModalProps {
  open: boolean;
  onClose: () => void;
}

function CreateTestModalInner({ open, onClose }: CreateTestModalProps): React.ReactElement | null {
  const { t } = useI18n();
  const campaignOptions = useMemo(() => getCampaignOptions(t), [t]);
  const [name, setName] = useState('');
  const [testType, setTestType] = useState<TestType>('creative');
  const [metric, setMetric] = useState<MetricType>('ctr');
  const [campaign, setCampaign] = useState(campaignOptions[0] ?? '');
  const [variants, setVariants] = useState<CreateFormVariant[]>([
    { name: '', description: '' },
    { name: '', description: '' },
  ]);
  const [trafficAllocation, setTrafficAllocation] = useState<TrafficAllocation>('equal');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mde, setMde] = useState(10);
  const [alpha, setAlpha] = useState(0.05);
  const [power, setPower] = useState(0.80);
  const [fromBatch, setFromBatch] = useState(false);

  const { perVariant, totalSample, estimatedDays } = useMemo(() => {
    const zAlpha = 1.96;
    const zBeta = 0.84;
    const baselineRate = metric === 'ctr' ? 0.05 : metric === 'cvr' ? 0.02 : 0;
    const mdeDecimal = mde / 100;

    let pv = 0;
    if (metric === 'roas' || metric === 'cpa') {
      pv = Math.ceil((2 * (zAlpha + zBeta) ** 2) / (mdeDecimal ** 2));
    } else {
      const p1 = baselineRate;
      const p2 = baselineRate * (1 + mdeDecimal);
      const diff = p1 - p2;
      if (diff !== 0) {
        pv = Math.ceil(
          ((zAlpha + zBeta) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2))) / (diff ** 2),
        );
      }
    }
    const ts = pv * variants.length;
    const ed = pv > 0 ? Math.ceil(ts / 1500) : 0;
    return { perVariant: pv, totalSample: ts, estimatedDays: ed };
  }, [metric, mde, variants.length]);

  const addVariant = useCallback((): void => {
    setVariants((prev) => [...prev, { name: '', description: '' }]);
  }, []);

  const removeVariant = useCallback((index: number): void => {
    setVariants((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const updateVariant = useCallback((index: number, field: keyof CreateFormVariant, value: string): void => {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">{t('abTests.createTitle')}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div>
            <label htmlFor="ab-test-name" className="mb-1 block text-sm font-medium text-foreground">{t('abTests.testName')}</label>
            <input
              id="ab-test-name"
              type="text"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={t('abtests.h115194')}
              required
            />
          </div>

          <div>
            <label htmlFor="ab-campaign" className="mb-1 block text-sm font-medium text-foreground">{t('abTests.campaignSelect')}</label>
            <div className="relative">
              <select
                id="ab-campaign"
                value={campaign}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCampaign(e.target.value)}
                className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {campaignOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div>
            <label htmlFor="ab-test-type" className="mb-1 block text-sm font-medium text-foreground">{t('abTests.testTypeLabel')}</label>
            <div className="relative">
              <select
                id="ab-test-type"
                value={testType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTestType(e.target.value as TestType)}
                className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {Object.entries(TEST_TYPE_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{t(config.labelKey)}</option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-foreground">{t('abTests.targetMetric')}</span>
            <div className="flex flex-wrap gap-2">
              {(['ctr', 'cvr', 'roas', 'cpa'] as const).map((m) => (
                <label
                  key={m}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                    metric === m
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50',
                  )}
                >
                  <input
                    type="radio"
                    name="ab-metric"
                    value={m}
                    checked={metric === m}
                    onChange={() => setMetric(m)}
                    className="sr-only"
                  />
                  {METRIC_CONFIG[m].label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-foreground">{t('abTests.addVariant')}</span>
            <div className="space-y-3">
              {variants.map((variant, idx) => (
                <div key={idx} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {idx === 0 ? t('abTests.controlLabel') : t('abTests.testLabel', { letter: String.fromCharCode(65 + idx) })}
                    </span>
                    {idx >= 2 && (
                      <button
                        type="button"
                        onClick={() => removeVariant(idx)}
                        className="rounded p-0.5 text-muted-foreground hover:text-red-600"
                        aria-label={t('abTests.removeVariant')}
                      >
                        <Minus size={14} />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={variant.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateVariant(idx, 'name', e.target.value)}
                    className="mt-2 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder={t('abTests.variantName')}
                    required
                  />
                  <input
                    type="text"
                    value={variant.description}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateVariant(idx, 'description', e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder={t('abTests.descriptionOptional')}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addVariant}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
            >
              <Plus size={14} />
              {t('abTests.addVariant')}
            </button>
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-foreground">{t('abTests.trafficAllocation')}</span>
            <div className="space-y-2">
              {TRAFFIC_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
                    trafficAllocation === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40',
                  )}
                >
                  <input
                    type="radio"
                    name="traffic"
                    value={opt.value}
                    checked={trafficAllocation === opt.value}
                    onChange={() => setTrafficAllocation(opt.value)}
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">{t(opt.labelKey)}</p>
                    <p className="text-xs text-muted-foreground">{t(opt.descKey)}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">{t('abTests.batchAutoCreate')}</p>
              <p className="text-xs text-muted-foreground">{t('abTests.batchAutoCreateDesc')}</p>
            </div>
            <button
              type="button"
              onClick={() => setFromBatch(!fromBatch)}
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors',
                fromBatch ? 'bg-primary' : 'bg-muted',
              )}
              role="switch"
              aria-checked={fromBatch}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                  fromBatch ? 'translate-x-5' : 'translate-x-0.5',
                )}
              />
            </button>
          </div>

          <div className="rounded-md border border-border">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <Settings2 size={14} className="text-muted-foreground" />
                {t('abTests.statisticalSettings')}
              </div>
              <ChevronDown size={14} className={cn('transition-transform', showAdvanced && 'rotate-180')} />
            </button>
            {showAdvanced && (
              <div className="space-y-4 border-t border-border px-4 py-4">
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="ab-mde" className="text-sm font-medium text-foreground">{t('abTests.mde')}</label>
                    <span className="text-sm font-semibold text-primary">{mde}%</span>
                  </div>
                  <input
                    id="ab-mde"
                    type="range"
                    min={5}
                    max={30}
                    step={1}
                    value={mde}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMde(Number(e.target.value))}
                    className="mt-2 w-full accent-primary"
                  />
                </div>
                <div>
                  <label htmlFor="ab-alpha" className="mb-1 block text-sm font-medium text-foreground">{t('abTests.alpha')}</label>
                  <input
                    id="ab-alpha"
                    type="number"
                    step={0.01}
                    min={0.01}
                    max={0.1}
                    value={alpha}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAlpha(Number(e.target.value))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label htmlFor="ab-power" className="mb-1 block text-sm font-medium text-foreground">{t('abTests.power')}</label>
                  <input
                    id="ab-power"
                    type="number"
                    step={0.05}
                    min={0.5}
                    max={0.99}
                    value={power}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPower(Number(e.target.value))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-md bg-primary/5 p-4">
            <p className="text-xs font-semibold text-primary">{t('abTests.requiredSampleSize')}</p>
            <p className="mt-1 text-sm text-foreground">
              {t('abTests.perVariant')} <span className="font-bold">{perVariant.toLocaleString()}</span> {t('abTests.impressionsUnit')}
              <span className="text-muted-foreground"> ({t('abTests.totalLabel')} {totalSample.toLocaleString()})</span>
            </p>
            {estimatedDays > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('abTests.estimatedDays', { days: String(estimatedDays) })}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={!name || variants.some((v) => !v.name)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {t('abTests.createTest')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export const CreateTestModal = memo(CreateTestModalInner);
