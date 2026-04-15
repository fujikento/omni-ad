'use client';

import { memo, useCallback, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Globe,
  Image as ImageIcon,
  Link2,
  Loader2,
  Monitor,
  Smartphone,
  Sparkles,
  Tablet,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { useI18n } from '@/lib/i18n';
import {
  ALL_PLATFORMS,
  BID_STRATEGY_OPTIONS,
  CAMPAIGN_TABS,
  OBJECTIVE_KEYS,
  PLATFORM_CONFIG,
  getAgeOptions,
  getConversionPoints,
  getExclusionAudiences,
  getInterestSuggestions,
  getRegionSuggestions,
  type BidStrategy,
  type CampaignTab,
  type Device,
  type Gender,
  type Objective,
  type Platform,
} from '../_types';
import { TagInput } from './tag-input';

interface CreateCampaignModalProps {
  open: boolean;
  onClose: () => void;
}

function CreateCampaignModalImpl({ open, onClose }: CreateCampaignModalProps): React.ReactElement | null {
  const { t } = useI18n();
  const [currentTab, setCurrentTab] = useState<CampaignTab>(0);

  // Tab 1: Basic Info
  const [name, setName] = useState('');
  const [objective, setObjective] = useState<Objective>('conversion');
  const [budgetTotal, setBudgetTotal] = useState('');
  const [dailyLimit, setDailyLimit] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [landingPageUrl, setLandingPageUrl] = useState('');
  const [bidStrategy, setBidStrategy] = useState<BidStrategy>('auto_maximize_conversions');
  const [targetCpa, setTargetCpa] = useState('');
  const [targetRoas, setTargetRoas] = useState('');

  // Tab 2: Conversion Settings
  const [conversionPoint, setConversionPoint] = useState<string>(getConversionPoints(t)[0] ?? '');
  const [cpaAlertLimit, setCpaAlertLimit] = useState('');
  const [roasAlertMin, setRoasAlertMin] = useState('');
  const [ctrAlertMin, setCtrAlertMin] = useState('');

  // Tab 3: Targeting
  const [ageMin, setAgeMin] = useState('18');
  const [ageMax, setAgeMax] = useState('65+');
  const [genders, setGenders] = useState<Gender[]>(['unspecified']);
  const [regions, setRegions] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [devices, setDevices] = useState<Device[]>(['all']);
  const [exclusionAudiences, setExclusionAudiences] = useState<string[]>([]);

  // Tab 4: Creative
  const [selectedCreativeIds, setSelectedCreativeIds] = useState<string[]>([]);
  const [aiAutoGenerate, setAiAutoGenerate] = useState(false);
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('cpc');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmContent, setUtmContent] = useState('');

  // Tab 5: Platforms
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [platformBudgetAllocation, setPlatformBudgetAllocation] = useState<Record<Platform, number>>({
    meta: 0, google: 0, x: 0, tiktok: 0, line_yahoo: 0, amazon: 0, microsoft: 0,
  });

  const createMutation = trpc.campaigns.create.useMutation({
    onSuccess: () => {
      onClose();
    },
  });

  const existingCreativesQuery = trpc.creatives.list.useQuery(undefined, { retry: false, enabled: open });
  const existingCreatives = (existingCreativesQuery.data as { id: string; name: string }[] | undefined) ?? [];

  // Auto-generate UTM when campaign name changes
  const updateUtmFromName = useCallback((campaignName: string) => {
    const slug = campaignName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    setUtmCampaign(slug || '');
  }, []);

  function togglePlatform(platform: Platform): void {
    setSelectedPlatforms((prev) => {
      const next = prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform];
      // Redistribute budget allocation evenly
      if (next.length > 0) {
        const evenShare = Math.floor(100 / next.length);
        const remainder = 100 - evenShare * next.length;
        const newAllocation = { ...platformBudgetAllocation };
        ALL_PLATFORMS.forEach((p) => {
          newAllocation[p] = next.includes(p) ? evenShare : 0;
        });
        const firstPlatform = next[0];
        if (next.length > 0 && firstPlatform) {
          newAllocation[firstPlatform] += remainder;
        }
        setPlatformBudgetAllocation(newAllocation);
      }
      return next;
    });
  }

  function toggleGender(g: Gender): void {
    setGenders((prev) =>
      prev.includes(g) ? prev.filter((v) => v !== g) : [...prev, g],
    );
  }

  function toggleDevice(d: Device): void {
    if (d === 'all') {
      setDevices(['all']);
      return;
    }
    setDevices((prev) => {
      const withoutAll = prev.filter((v) => v !== 'all');
      const next = withoutAll.includes(d)
        ? withoutAll.filter((v) => v !== d)
        : [...withoutAll, d];
      return next.length === 0 ? ['all'] : next;
    });
  }

  function toggleCreative(id: string): void {
    setSelectedCreativeIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  }

  function toggleExclusionAudience(audience: string): void {
    setExclusionAudiences((prev) =>
      prev.includes(audience) ? prev.filter((v) => v !== audience) : [...prev, audience],
    );
  }

  function handlePlatformBudgetChange(platform: Platform, value: number): void {
    setPlatformBudgetAllocation((prev) => ({ ...prev, [platform]: value }));
  }

  function canAdvanceTab(tab: CampaignTab): boolean {
    switch (tab) {
      case 0:
        return Boolean(name && budgetTotal && startDate);
      case 1:
        return true;
      case 2:
        return true;
      case 3:
        return true;
      case 4:
        return selectedPlatforms.length > 0;
      default:
        return true;
    }
  }

  function handleSubmit(): void {
    if (!name || !budgetTotal || selectedPlatforms.length === 0 || !startDate) return;

    createMutation.mutate({
      name,
      objective,
      totalBudget: budgetTotal,
      dailyBudget: dailyLimit || budgetTotal,
      startDate,
      endDate: endDate || undefined,
    });
  }

  if (!open) return null;

  const inputCls = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';
  const labelCls = 'mb-1 block text-sm font-medium text-foreground';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-2xl flex-col rounded-lg border border-border bg-card shadow-xl" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">{t('campaigns.createTitle')}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex border-b border-border" role="tablist" aria-label={t('campaigns.campaignSteps')}>
          {CAMPAIGN_TABS.map((tab, index) => {
            const tabIndex = index as CampaignTab;
            const isCurrent = currentTab === tabIndex;
            const isCompleted = currentTab > tabIndex;
            return (
              <button
                key={tab.labelKey}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                aria-controls={`campaign-tab-panel-${index}`}
                onClick={() => setCurrentTab(tabIndex)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-xs font-medium transition-colors',
                  isCurrent
                    ? 'border-primary text-primary'
                    : isCompleted
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {isCompleted ? <Check size={12} className="text-green-500" /> : tab.icon}
                <span className="hidden sm:inline">{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Tab 1: Basic Info */}
          {currentTab === 0 && (
            <div className="space-y-4" id="campaign-tab-panel-0" role="tabpanel">
              <div>
                <label htmlFor="campaign-name" className={labelCls}>{t('campaigns.name')}</label>
                <input
                  id="campaign-name"
                  type="text"
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setName(e.target.value);
                    updateUtmFromName(e.target.value);
                  }}
                  className={inputCls}
                  placeholder={t('campaigns.campaignNamePlaceholder')}
                  required
                />
              </div>

              <div>
                <label htmlFor="campaign-objective" className={labelCls}>{t('campaigns.objective')}</label>
                <div className="relative">
                  <select
                    id="campaign-objective"
                    value={objective}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setObjective(e.target.value as Objective)}
                    className={cn(inputCls, 'appearance-none pr-8')}
                  >
                    {OBJECTIVE_KEYS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="campaign-budget" className={labelCls}>{t('campaigns.totalBudgetJpy')}</label>
                  <input
                    id="campaign-budget"
                    type="number"
                    value={budgetTotal}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBudgetTotal(e.target.value)}
                    className={inputCls}
                    placeholder="500000"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="campaign-daily-limit" className={labelCls}>{t('campaigns.dailyLimitOptional')}</label>
                  <input
                    id="campaign-daily-limit"
                    type="number"
                    value={dailyLimit}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDailyLimit(e.target.value)}
                    className={inputCls}
                    placeholder="50000"
                    min="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="campaign-start" className={labelCls}>{t('campaigns.startDate')}</label>
                  <input
                    id="campaign-start"
                    type="date"
                    value={startDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="campaign-end" className={labelCls}>{t('campaigns.endDateOptional')}</label>
                  <input
                    id="campaign-end"
                    type="date"
                    value={endDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="campaign-lp-url" className={labelCls}>
                  <span className="flex items-center gap-1.5">
                    <Link2 size={14} />
                    {t('campaigns.landingPageUrl')}
                  </span>
                </label>
                <input
                  id="campaign-lp-url"
                  type="url"
                  value={landingPageUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLandingPageUrl(e.target.value)}
                  className={inputCls}
                  placeholder="https://example.com/landing"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('campaigns.landingPageHint')}
                </p>
              </div>

              <div>
                <span className="mb-2 block text-sm font-medium text-foreground">{t('campaigns.bidStrategy')}</span>
                <div className="space-y-2">
                  {BID_STRATEGY_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                        bidStrategy === option.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/30',
                      )}
                    >
                      <input
                        type="radio"
                        name="bid-strategy"
                        value={option.value}
                        checked={bidStrategy === option.value}
                        onChange={() => setBidStrategy(option.value)}
                        className="mt-0.5 accent-primary"
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">{t(option.labelKey)}</p>
                        <p className="text-xs text-muted-foreground">{t(option.descKey)}</p>
                      </div>
                    </label>
                  ))}
                </div>
                {bidStrategy === 'auto_target_cpa' && (
                  <div className="mt-3">
                    <label htmlFor="bid-target-cpa" className={labelCls}>{t('campaigns.targetCpaJpy')}</label>
                    <input
                      id="bid-target-cpa"
                      type="number"
                      value={targetCpa}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetCpa(e.target.value)}
                      className={inputCls}
                      placeholder="3000"
                      min="1"
                    />
                  </div>
                )}
                {bidStrategy === 'auto_target_roas' && (
                  <div className="mt-3">
                    <label htmlFor="bid-target-roas" className={labelCls}>{t('campaigns.targetRoasMultiple')}</label>
                    <input
                      id="bid-target-roas"
                      type="number"
                      value={targetRoas}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetRoas(e.target.value)}
                      className={inputCls}
                      placeholder="3.0"
                      min="0"
                      step="0.1"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Conversion Settings */}
          {currentTab === 1 && (
            <div className="space-y-5" id="campaign-tab-panel-1" role="tabpanel">
              <div>
                <label htmlFor="conversion-point" className={labelCls}>{t('campaigns.conversionPoint')}</label>
                <div className="relative">
                  <select
                    id="conversion-point"
                    value={conversionPoint}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setConversionPoint(e.target.value)
                    }
                    className={cn(inputCls, 'appearance-none pr-8')}
                  >
                    {getConversionPoints(t).map((cp) => (
                      <option key={cp} value={cp}>{cp}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              {bidStrategy === 'auto_target_cpa' && (
                <div>
                  <label htmlFor="cv-target-cpa" className={labelCls}>{t('campaigns.targetCpaJpy')}</label>
                  <input
                    id="cv-target-cpa"
                    type="number"
                    value={targetCpa}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetCpa(e.target.value)}
                    className={inputCls}
                    placeholder="3000"
                    min="1"
                  />
                </div>
              )}

              {bidStrategy === 'auto_target_roas' && (
                <div>
                  <label htmlFor="cv-target-roas" className={labelCls}>{t('campaigns.targetRoasMultiple')}</label>
                  <input
                    id="cv-target-roas"
                    type="number"
                    value={targetRoas}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetRoas(e.target.value)}
                    className={inputCls}
                    placeholder="3.0"
                    min="0"
                    step="0.1"
                  />
                </div>
              )}

              <div className="rounded-lg border border-border p-4">
                <h4 className="mb-3 text-sm font-semibold text-foreground">{t('campaigns.kpiAlertSettings')}</h4>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="alert-cpa-limit" className={labelCls}>
                      {t('campaigns.cpaUpperLimit')}
                    </label>
                    <input
                      id="alert-cpa-limit"
                      type="number"
                      value={cpaAlertLimit}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCpaAlertLimit(e.target.value)}
                      className={inputCls}
                      placeholder="5000"
                      min="1"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{t('campaigns.cpaAlertHint')}</p>
                  </div>
                  <div>
                    <label htmlFor="alert-roas-min" className={labelCls}>{t('campaigns.roasLowerLimit')}</label>
                    <input
                      id="alert-roas-min"
                      type="number"
                      value={roasAlertMin}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRoasAlertMin(e.target.value)}
                      className={inputCls}
                      placeholder="2.0"
                      min="0"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label htmlFor="alert-ctr-min" className={labelCls}>{t('campaigns.ctrLowerLimit')}</label>
                    <input
                      id="alert-ctr-min"
                      type="number"
                      value={ctrAlertMin}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCtrAlertMin(e.target.value)}
                      className={inputCls}
                      placeholder="1.5"
                      min="0"
                      step="0.1"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Targeting */}
          {currentTab === 2 && (
            <div className="space-y-5" id="campaign-tab-panel-2" role="tabpanel">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="age-min" className={labelCls}>{t('campaigns.ageMin')}</label>
                  <div className="relative">
                    <select
                      id="age-min"
                      value={ageMin}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAgeMin(e.target.value)}
                      className={cn(inputCls, 'appearance-none pr-8')}
                    >
                      {getAgeOptions().map((age) => (
                        <option key={age} value={age}>{age}{t('campaigns.ageSuffix')}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <label htmlFor="age-max" className={labelCls}>{t('campaigns.ageMax')}</label>
                  <div className="relative">
                    <select
                      id="age-max"
                      value={ageMax}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAgeMax(e.target.value)}
                      className={cn(inputCls, 'appearance-none pr-8')}
                    >
                      {getAgeOptions().map((age) => (
                        <option key={age} value={age}>{age}{t('campaigns.ageSuffix')}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
              </div>

              <div>
                <span className="mb-2 block text-sm font-medium text-foreground">{t('campaigns.gender')}</span>
                <div className="flex gap-2">
                  {([
                    { value: 'male' as Gender, labelKey: 'campaigns.genderMale' },
                    { value: 'female' as Gender, labelKey: 'campaigns.genderFemale' },
                    { value: 'unspecified' as Gender, labelKey: 'campaigns.genderUnspecified' },
                  ]).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleGender(option.value)}
                      className={cn(
                        'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                        genders.includes(option.value)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/50',
                      )}
                    >
                      {t(option.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              <TagInput
                id="targeting-regions"
                label={t('campaigns.region')}
                tags={regions}
                onAdd={(tag) => setRegions((prev) => [...prev, tag])}
                onRemove={(tag) => setRegions((prev) => prev.filter((t) => t !== tag))}
                suggestions={getRegionSuggestions(t)}
                placeholder={t('campaigns.regionPlaceholder')}
              />

              <TagInput
                id="targeting-interests"
                label={t('campaigns.interests')}
                tags={interests}
                onAdd={(tag) => setInterests((prev) => [...prev, tag])}
                onRemove={(tag) => setInterests((prev) => prev.filter((t) => t !== tag))}
                suggestions={getInterestSuggestions(t)}
                placeholder={t('campaigns.interestsPlaceholder')}
              />

              <div>
                <span className="mb-2 block text-sm font-medium text-foreground">{t('campaigns.device')}</span>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: 'all' as Device, labelKey: 'campaigns.deviceAll', icon: <Globe size={14} /> },
                    { value: 'mobile' as Device, labelKey: 'campaigns.deviceMobile', icon: <Smartphone size={14} /> },
                    { value: 'desktop' as Device, labelKey: 'campaigns.deviceDesktop', icon: <Monitor size={14} /> },
                    { value: 'tablet' as Device, labelKey: 'campaigns.deviceTablet', icon: <Tablet size={14} /> },
                  ]).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleDevice(option.value)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                        devices.includes(option.value)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/50',
                      )}
                    >
                      {option.icon}
                      {t(option.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-2 block text-sm font-medium text-foreground">{t('campaigns.exclusionAudiences')}</span>
                <div className="flex flex-wrap gap-2">
                  {getExclusionAudiences(t).map((audience) => (
                    <button
                      key={audience}
                      type="button"
                      onClick={() => toggleExclusionAudience(audience)}
                      className={cn(
                        'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                        exclusionAudiences.includes(audience)
                          ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400'
                          : 'border-border text-muted-foreground hover:border-red-300/50',
                      )}
                    >
                      {audience}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Creative */}
          {currentTab === 3 && (
            <div className="space-y-5" id="campaign-tab-panel-3" role="tabpanel">
              <div>
                <span className="mb-2 block text-sm font-medium text-foreground">{t('campaigns.selectFromCreatives')}</span>
                {existingCreatives.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
                    {t('common.noData')}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {existingCreatives.map((creative) => {
                      const isSelected = selectedCreativeIds.includes(creative.id);
                      return (
                        <button
                          key={creative.id}
                          type="button"
                          onClick={() => toggleCreative(creative.id)}
                          className={cn(
                            'group relative rounded-lg border-2 p-2 text-left transition-all',
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/30',
                          )}
                        >
                          <div className="flex h-20 items-center justify-center rounded-md bg-muted/50">
                            <ImageIcon size={24} className="text-muted-foreground/30" />
                          </div>
                          <p className="mt-1.5 text-xs font-medium text-foreground line-clamp-1">
                            {creative.name}
                          </p>
                          {isSelected && (
                            <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                              <Check size={12} className="text-primary-foreground" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-primary" />
                    <span className="text-sm font-semibold text-foreground">{t('campaigns.aiAutoGenerate')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiAutoGenerate(!aiAutoGenerate)}
                    className={cn(
                      'relative h-6 w-11 rounded-full transition-colors',
                      aiAutoGenerate ? 'bg-primary' : 'bg-muted',
                    )}
                    role="switch"
                    aria-checked={aiAutoGenerate}
                    aria-label={t('campaigns.enableAiAutoGenerate')}
                  >
                    <span className={cn(
                      'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                      aiAutoGenerate && 'translate-x-5',
                    )} />
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('campaigns.aiAutoGenerateDesc')}
                </p>
              </div>

              <div className="rounded-lg border border-border p-4">
                <h4 className="mb-3 text-sm font-semibold text-foreground">{t('campaigns.utmParameters')}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="utm-source" className={labelCls}>utm_source</label>
                    <input
                      id="utm-source"
                      type="text"
                      value={utmSource}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUtmSource(e.target.value)}
                      className={inputCls}
                      placeholder="google"
                    />
                  </div>
                  <div>
                    <label htmlFor="utm-medium" className={labelCls}>utm_medium</label>
                    <input
                      id="utm-medium"
                      type="text"
                      value={utmMedium}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUtmMedium(e.target.value)}
                      className={inputCls}
                      placeholder="cpc"
                    />
                  </div>
                  <div>
                    <label htmlFor="utm-campaign" className={labelCls}>utm_campaign</label>
                    <input
                      id="utm-campaign"
                      type="text"
                      value={utmCampaign}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUtmCampaign(e.target.value)}
                      className={inputCls}
                      placeholder="spring_promotion"
                    />
                  </div>
                  <div>
                    <label htmlFor="utm-content" className={labelCls}>utm_content</label>
                    <input
                      id="utm-content"
                      type="text"
                      value={utmContent}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUtmContent(e.target.value)}
                      className={inputCls}
                      placeholder="banner_a"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Platforms */}
          {currentTab === 4 && (
            <div className="space-y-5" id="campaign-tab-panel-4" role="tabpanel">
              <div>
                <span className="mb-2 block text-sm font-medium text-foreground">{t('campaigns.deliveryPlatforms')}</span>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(PLATFORM_CONFIG) as [Platform, { label: string; color: string }][]).map(
                    ([key, config]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => togglePlatform(key)}
                        className={cn(
                          'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                          selectedPlatforms.includes(key)
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/50',
                        )}
                      >
                        {config.label}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {selectedPlatforms.length > 0 && (
                <div className="rounded-lg border border-border p-4">
                  <h4 className="mb-3 text-sm font-semibold text-foreground">{t('campaigns.budgetAllocationPercent')}</h4>
                  <div className="space-y-3">
                    {selectedPlatforms.map((platform) => (
                      <div key={platform} className="flex items-center gap-3">
                        <span className="w-16 text-sm font-medium text-foreground">
                          {PLATFORM_CONFIG[platform].label}
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={platformBudgetAllocation[platform]}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            handlePlatformBudgetChange(platform, Number(e.target.value))
                          }
                          className="flex-1 accent-primary"
                          aria-label={t('campaigns.ariaBudgetAllocation', { platform: PLATFORM_CONFIG[platform].label })}
                        />
                        <span className="w-12 text-right text-sm font-semibold text-foreground">
                          {platformBudgetAllocation[platform]}%
                        </span>
                      </div>
                    ))}
                    {(() => {
                      const total = selectedPlatforms.reduce(
                        (sum, p) => sum + platformBudgetAllocation[p], 0,
                      );
                      return (
                        <div className={cn(
                          'flex items-center justify-between border-t border-border pt-2 text-sm font-semibold',
                          total === 100 ? 'text-green-600' : 'text-yellow-600',
                        )}>
                          <span>{t('campaigns.total')}</span>
                          <span>{total}%</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {selectedPlatforms.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-foreground">{t('campaigns.platformSpecificSettings')}</h4>
                  <div className="space-y-2">
                    {selectedPlatforms.map((platform) => (
                      <details
                        key={platform}
                        className="rounded-lg border border-border"
                      >
                        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/30">
                          <span className={cn(
                            'inline-flex h-5 items-center rounded px-1.5 text-[10px] font-medium text-white',
                            PLATFORM_CONFIG[platform].color,
                          )}>
                            {PLATFORM_CONFIG[platform].label}
                          </span>
                          {t('campaigns.platformSpecificSettingsLabel')}
                        </summary>
                        <div className="border-t border-border px-4 py-3">
                          <p className="text-xs text-muted-foreground">
                            {t('campaigns.platformSpecificSettingsHint', { platform: PLATFORM_CONFIG[platform].label })}
                          </p>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={() => currentTab > 0 && setCurrentTab((currentTab - 1) as CampaignTab)}
            disabled={currentTab === 0}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-30"
          >
            <ChevronLeft size={14} />
            {t('common.back')}
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              {t('common.cancel')}
            </button>
            {currentTab < 4 ? (
              <button
                type="button"
                onClick={() => setCurrentTab((currentTab + 1) as CampaignTab)}
                disabled={!canAdvanceTab(currentTab)}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {t('common.next')}
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={createMutation.isPending || !name || !budgetTotal || selectedPlatforms.length === 0 || !startDate}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                {t('common.create')}
              </button>
            )}
          </div>
        </div>

        {createMutation.error && (
          <div className="border-t border-border px-6 py-3">
            <p className="text-sm text-destructive">{createMutation.error.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export const CreateCampaignModal = memo(CreateCampaignModalImpl);
