'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronDown,
  Edit3,
  Eye,
  Home,
  LayoutDashboard,
  Link2,
  Loader2,
  Megaphone,
  MousePointerClick,
  BarChart3,
  RefreshCcw,
  Rocket,
  ShoppingCart,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { PlatformIcon } from '@omni-ad/ui';
import { Platform, type DbPlatformKey } from '@omni-ad/shared';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

// ============================================================
// Types
// ============================================================

type OnboardingStep = 0 | 1 | 2 | 3;
type CampaignObjective = 'awareness' | 'traffic' | 'conversion' | 'retargeting';
type ConversionGoal = 'purchase' | 'lead' | 'app_install';

interface PlatformCard {
  id: DbPlatformKey;
  name: string;
  enumKey: Platform;
  color: string;
}

interface ObjectiveCard {
  id: CampaignObjective;
  label: string;
  description: string;
  icon: React.ReactNode;
}

interface AiGeneratedPlan {
  objective: string;
  targeting: string;
  budget: string;
  creative: string;
  platforms: string;
}

// ============================================================
// Constants
// ============================================================

const STEPS: { labelKey: string; number: number }[] = [
  { labelKey: 'onboarding.stepWelcome', number: 1 },
  { labelKey: 'onboarding.stepPlatforms', number: 2 },
  { labelKey: 'onboarding.stepCampaign', number: 3 },
  { labelKey: 'onboarding.stepComplete', number: 4 },
];

const PLATFORMS: PlatformCard[] = [
  { id: 'meta', name: 'Meta (Facebook / Instagram)', enumKey: Platform.META, color: 'border-border hover:border-indigo-400 dark:hover:border-indigo-500' },
  { id: 'google', name: 'Google Ads', enumKey: Platform.GOOGLE, color: 'border-border hover:border-blue-400 dark:hover:border-blue-500' },
  { id: 'x', name: 'X (Twitter)', enumKey: Platform.X, color: 'border-border hover:border-muted-foreground' },
  { id: 'tiktok', name: 'TikTok Ads', enumKey: Platform.TIKTOK, color: 'border-border hover:border-pink-400 dark:hover:border-pink-500' },
  { id: 'line_yahoo', name: 'LINE / Yahoo!', enumKey: Platform.LINE_YAHOO, color: 'border-border hover:border-green-400 dark:hover:border-green-500' },
  { id: 'amazon', name: 'Amazon Ads', enumKey: Platform.AMAZON, color: 'border-border hover:border-orange-400 dark:hover:border-orange-500' },
  { id: 'microsoft', name: 'Microsoft Ads', enumKey: Platform.MICROSOFT, color: 'border-border hover:border-cyan-400 dark:hover:border-cyan-500' },
];

const CONVERSION_GOALS: { value: ConversionGoal; labelKey: string }[] = [
  { value: 'purchase', labelKey: 'onboarding.goalPurchase' },
  { value: 'lead', labelKey: 'onboarding.goalLead' },
  { value: 'app_install', labelKey: 'onboarding.goalAppInstall' },
];

function getOnboardingAgeOptions(): readonly string[] {
  return ['18', '20', '25', '30', '35', '40', '45', '50', '55', '60', '65+'] as const;
}

function getOnboardingRegionOptions(t: (key: string, params?: Record<string, string | number>) => string): string[] {
  return [t('onboarding.h707ba1'), t('onboarding.hd94e2b'), t('onboarding.h20b7eb'), t('onboarding.h81fd0e'), t('onboarding.haf0713'), t('onboarding.he31419'), t('onboarding.hcda9a8'), t('onboarding.h841dd1'), t('onboarding.h030dd7'), t('onboarding.h403713')];
}

const OBJECTIVES: (Omit<ObjectiveCard, 'label' | 'description'> & { labelKey: string; descriptionKey: string })[] = [
  { id: 'awareness', labelKey: 'onboarding.objectiveAwareness', descriptionKey: 'onboarding.objectiveAwarenessDesc', icon: <Eye size={28} className="text-blue-500" /> },
  { id: 'traffic', labelKey: 'onboarding.objectiveTraffic', descriptionKey: 'onboarding.objectiveTrafficDesc', icon: <MousePointerClick size={28} className="text-green-500" /> },
  { id: 'conversion', labelKey: 'onboarding.objectiveConversion', descriptionKey: 'onboarding.objectiveConversionDesc', icon: <ShoppingCart size={28} className="text-purple-500" /> },
  { id: 'retargeting', labelKey: 'onboarding.objectiveRetargeting', descriptionKey: 'onboarding.objectiveRetargetingDesc', icon: <RefreshCcw size={28} className="text-orange-500" /> },
];

// ============================================================
// Subcomponents
// ============================================================

function StepIndicator({ currentStep }: { currentStep: OnboardingStep }): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((step, index) => {
        const stepIndex = index as OnboardingStep;
        const isCompleted = currentStep > stepIndex;
        const isCurrent = currentStep === stepIndex;
        return (
          <div key={step.number} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
                isCompleted
                  ? 'bg-primary text-primary-foreground'
                  : isCurrent
                    ? 'border-2 border-primary bg-primary/10 text-primary'
                    : 'border border-border bg-muted text-muted-foreground',
              )}
            >
              {isCompleted ? <Check size={14} /> : step.number}
            </div>
            <span className={cn(
              'hidden text-xs font-medium sm:inline',
              isCurrent ? 'text-foreground' : 'text-muted-foreground',
            )}>
              {t(step.labelKey)}
            </span>
            {index < STEPS.length - 1 && (
              <div className={cn(
                'h-px w-8',
                isCompleted ? 'bg-primary' : 'bg-border',
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
        <Rocket size={40} className="text-primary" />
      </div>
      <h2 className="mt-6 text-2xl font-bold text-foreground">
        {t('onboarding.welcomeTitle')}
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {t('onboarding.welcomeDesc')}
      </p>

      <div className="mt-8 grid w-full max-w-lg grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <Megaphone size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">{t('onboarding.featureUnified')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('onboarding.featureUnifiedDesc')}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
            <BrainCircuit size={20} className="text-purple-600 dark:text-purple-400" />
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">{t('onboarding.featureAi')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('onboarding.featureAiDesc')}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <BarChart3 size={20} className="text-green-600 dark:text-green-400" />
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">{t('onboarding.featureAnalytics')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('onboarding.featureAnalyticsDesc')}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="mt-8 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        {t('onboarding.startSetup')}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

function PlatformStep({
  connectedPlatforms,
  onToggle,
  onNext,
  onBack,
}: {
  connectedPlatforms: Set<string>;
  onToggle: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}): React.ReactElement {
  const { t } = useI18n();
  return (
    <div>
      <h2 className="text-xl font-bold text-foreground">{t('onboarding.platformsTitle')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('onboarding.platformsDesc')}
      </p>
      <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
        {t('onboarding.platformsMinOne')}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((platform) => {
          const isSelected = connectedPlatforms.has(platform.id);
          return (
            <button
              key={platform.id}
              type="button"
              onClick={() => onToggle(platform.id)}
              aria-pressed={isSelected}
              className={cn(
                'relative flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : platform.color,
              )}
            >
              <div className={cn(
                'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-card',
                isSelected ? 'ring-2 ring-primary/30' : '',
              )}>
                <PlatformIcon platform={platform.enumKey} size={28} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{platform.name}</p>
                {isSelected ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <Check size={12} />
                    {t('onboarding.platformSelected')}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">{t('onboarding.platformSelect')}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
          {t('onboarding.h4a622f')}
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onNext}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t('onboarding.skipForNow')}
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={connectedPlatforms.size === 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {t('onboarding.h0e032e')}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function CampaignStep({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}): React.ReactElement {
  const { t } = useI18n();
  const [campaignName, setCampaignName] = useState('');
  const [selectedObjective, setSelectedObjective] = useState<CampaignObjective | null>(null);
  const [budget, setBudget] = useState('');
  const [aiMode, setAiMode] = useState(false);
  const [businessGoal, setBusinessGoal] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPlan, setAiPlan] = useState<AiGeneratedPlan | null>(null);
  const [editingPlanField, setEditingPlanField] = useState<keyof AiGeneratedPlan | null>(null);

  // New fields
  const [landingPageUrl, setLandingPageUrl] = useState('');
  const [conversionGoal, setConversionGoal] = useState<ConversionGoal>('purchase');
  const [targetCpa, setTargetCpa] = useState('');
  const [targetRoas, setTargetRoas] = useState('');
  const [ageMin, setAgeMin] = useState('18');
  const [ageMax, setAgeMax] = useState('65+');
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  const inputCls = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';
  const labelCls = 'mb-1 block text-sm font-medium text-foreground';

  function toggleRegion(region: string): void {
    setSelectedRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region],
    );
  }

  function handleAiGenerate(): void {
    if (!businessGoal.trim()) return;
    setAiGenerating(true);
    // Simulate AI generation
    setTimeout(() => {
      setAiPlan({
        objective: t('onboarding.hcf29b1'),
        targeting: t('onboarding.heb1d5a'),
        budget: t('onboarding.hb0dc08'),
        creative: t('onboarding.hb1f05f'),
        platforms: 'Google Ads, Meta (Instagram), TikTok',
      });
      setAiGenerating(false);
    }, 2500);
  }

  function handleEditPlanField(field: keyof AiGeneratedPlan, value: string): void {
    if (!aiPlan) return;
    setAiPlan({ ...aiPlan, [field]: value });
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground">{t('onboarding.campaignTitle')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('onboarding.campaignDesc')}
      </p>

      {/* AI Campaign Architect toggle */}
      <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            <span className="text-sm font-semibold text-foreground">{t('onboarding.aiArchitect')}</span>
          </div>
          <button
            type="button"
            onClick={() => { setAiMode(!aiMode); setAiPlan(null); }}
            className={cn(
              'relative h-6 w-11 rounded-full transition-colors',
              aiMode ? 'bg-primary' : 'bg-muted',
            )}
            role="switch"
            aria-checked={aiMode}
            aria-label={t('onboarding.aiArchitectEnable')}
          >
            <span className={cn(
              'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
              aiMode && 'translate-x-5',
            )} />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('onboarding.aiArchitectDesc')}
        </p>
        {aiMode && !aiPlan && (
          <div className="mt-3 space-y-3">
            <label htmlFor="business-goal" className="sr-only">{t('onboarding.ariaBusinessGoal')}</label>
            <textarea
              id="business-goal"
              value={businessGoal}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBusinessGoal(e.target.value)}
              className={inputCls}
              rows={3}
              placeholder={t('onboarding.businessGoalPlaceholder')}
            />
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={aiGenerating || !businessGoal.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {aiGenerating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <BrainCircuit size={14} />
              )}
              {aiGenerating ? t('onboarding.aiAnalyzing') : t('onboarding.aiDesign')}
            </button>
          </div>
        )}

        {/* AI Generated Plan Display */}
        {aiMode && aiPlan && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Check size={16} className="text-green-500" />
              <span className="text-sm font-semibold text-success">{t('onboarding.planGenerated')}</span>
            </div>
            {(Object.entries(aiPlan) as [keyof AiGeneratedPlan, string][]).map(([key, value]) => {
              const fieldLabels: Record<keyof AiGeneratedPlan, string> = {
                objective: t('onboarding.fieldObjective'),
                targeting: t('onboarding.fieldTargeting'),
                budget: t('onboarding.fieldBudget'),
                creative: t('onboarding.fieldCreative'),
                platforms: t('onboarding.fieldPlatforms'),
              };
              const isEditing = editingPlanField === key;
              return (
                <div key={key} className="rounded-md border border-border bg-background p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">{fieldLabels[key]}</span>
                    <button
                      type="button"
                      onClick={() => setEditingPlanField(isEditing ? null : key)}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                      aria-label={t('onboarding.ariaEditField', { field: fieldLabels[key] })}
                    >
                      <Edit3 size={10} />
                      {isEditing ? t('onboarding.doneEditing') : t('onboarding.editField')}
                    </button>
                  </div>
                  {isEditing ? (
                    <input
                      type="text"
                      value={value}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleEditPlanField(key, e.target.value)}
                      className={cn(inputCls, 'mt-1')}
                    />
                  ) : (
                    <p className="mt-1 text-sm text-foreground">{value}</p>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setAiPlan(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t('onboarding.regenerate')}
            </button>
          </div>
        )}
      </div>

      {!aiMode && (
        <div className="mt-6 space-y-6">
          {/* Campaign name */}
          <div>
            <label htmlFor="onboarding-campaign-name" className={labelCls}>
              {t('onboarding.campaignName')}
            </label>
            <input
              id="onboarding-campaign-name"
              type="text"
              value={campaignName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCampaignName(e.target.value)}
              className={inputCls}
              placeholder={t('onboarding.campaignNamePlaceholder')}
            />
          </div>

          {/* Objective selection */}
          <div>
            <span className="mb-2 block text-sm font-medium text-foreground">{t('onboarding.objectiveLabel')}</span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {OBJECTIVES.map((obj) => (
                <button
                  key={obj.id}
                  type="button"
                  onClick={() => setSelectedObjective(obj.id)}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all',
                    selectedObjective === obj.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/30',
                  )}
                >
                  <div className="flex-shrink-0">{obj.icon}</div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t(obj.labelKey)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t(obj.descriptionKey)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div>
            <label htmlFor="onboarding-budget" className={labelCls}>
              {t('onboarding.monthlyBudget')}
            </label>
            <input
              id="onboarding-budget"
              type="number"
              value={budget}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBudget(e.target.value)}
              className={inputCls}
              placeholder="500000"
              min="1"
            />
          </div>

          {/* Landing Page URL */}
          <div>
            <label htmlFor="onboarding-lp-url" className={labelCls}>
              <span className="flex items-center gap-1.5">
                <Link2 size={14} />
                {t('onboarding.landingPageUrl')}
              </span>
            </label>
            <input
              id="onboarding-lp-url"
              type="url"
              value={landingPageUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLandingPageUrl(e.target.value)}
              className={inputCls}
              placeholder="https://example.com/landing"
            />
          </div>

          {/* Conversion Goal */}
          <div>
            <label htmlFor="onboarding-conversion-goal" className={labelCls}>
              <span className="flex items-center gap-1.5">
                <Target size={14} />
                {t('onboarding.conversionGoal')}
              </span>
            </label>
            <div className="relative">
              <select
                id="onboarding-conversion-goal"
                value={conversionGoal}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setConversionGoal(e.target.value as ConversionGoal)}
                className={cn(inputCls, 'appearance-none pr-8')}
              >
                {CONVERSION_GOALS.map((cg) => (
                  <option key={cg.value} value={cg.value}>{t(cg.labelKey)}</option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Target CPA / ROAS */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="onboarding-target-cpa" className={labelCls}>{t('onboarding.targetCpa')}</label>
              <input
                id="onboarding-target-cpa"
                type="number"
                value={targetCpa}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetCpa(e.target.value)}
                className={inputCls}
                placeholder="3000"
                min="1"
              />
            </div>
            <div>
              <label htmlFor="onboarding-target-roas" className={labelCls}>{t('onboarding.targetRoas')}</label>
              <input
                id="onboarding-target-roas"
                type="number"
                value={targetRoas}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetRoas(e.target.value)}
                className={inputCls}
                placeholder="3.0"
                min="0"
                step="0.1"
              />
            </div>
          </div>

          {/* Basic Targeting */}
          <div className="rounded-lg border border-border p-4">
            <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Users size={14} />
              {t('onboarding.basicTargeting')}
            </h4>

            {/* Age range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="onboarding-age-min" className={labelCls}>{t('onboarding.ageMin')}</label>
                <div className="relative">
                  <select
                    id="onboarding-age-min"
                    value={ageMin}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAgeMin(e.target.value)}
                    className={cn(inputCls, 'appearance-none pr-8')}
                  >
                    {getOnboardingAgeOptions().map((age) => (
                      <option key={age} value={age}>{age}{t('onboarding.ageSuffix')}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <div>
                <label htmlFor="onboarding-age-max" className={labelCls}>{t('onboarding.ageMax')}</label>
                <div className="relative">
                  <select
                    id="onboarding-age-max"
                    value={ageMax}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAgeMax(e.target.value)}
                    className={cn(inputCls, 'appearance-none pr-8')}
                  >
                    {getOnboardingAgeOptions().map((age) => (
                      <option key={age} value={age}>{age}{t('onboarding.ageSuffix')}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* Region */}
            <div className="mt-3">
              <span className={labelCls}>{t('onboarding.region')}</span>
              <div className="flex flex-wrap gap-1.5">
                {getOnboardingRegionOptions(t).map((region) => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => toggleRegion(region)}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                      selectedRegions.includes(region)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50',
                    )}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
          {t('onboarding.h4a622f')}
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t('onboarding.finish')}
          <Check size={16} />
        </button>
      </div>
    </div>
  );
}

function CompletionStep(): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
        <Check size={40} className="text-success" />
      </div>
      <h2 className="mt-6 text-2xl font-bold text-foreground">
        {t('onboarding.completeTitle')}
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {t('onboarding.completeDesc')}
      </p>

      <div className="mt-8 grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-3">
        <a
          href="/home"
          className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-muted/30"
        >
          <Home size={24} className="text-primary" />
          <span className="text-sm font-medium text-foreground">{t('onboarding.gotoDashboard')}</span>
        </a>
        <Link
          href="/campaigns"
          className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-muted/30"
        >
          <LayoutDashboard size={24} className="text-primary" />
          <span className="text-sm font-medium text-foreground">{t('onboarding.gotoCampaigns')}</span>
        </Link>
        <a
          href="/analytics"
          className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-muted/30"
        >
          <BarChart3 size={24} className="text-primary" />
          <span className="text-sm font-medium text-foreground">{t('onboarding.gotoAnalytics')}</span>
        </a>
      </div>

      <a
        href="/home"
        className="mt-6 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        <Users size={16} />
        {t('onboarding.viewTour')}
      </a>
    </div>
  );
}

// ============================================================
// Main Onboarding Page
// ============================================================

export default function OnboardingPage(): React.ReactElement {
  const [step, setStep] = useState<OnboardingStep>(0);
  const [connectedPlatforms, setConnectedPlatforms] = useState<Set<string>>(new Set());

  function togglePlatform(id: string): void {
    setConnectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function goNext(): void {
    setStep((prev) => Math.min(3, prev + 1) as OnboardingStep);
  }

  function goBack(): void {
    setStep((prev) => Math.max(0, prev - 1) as OnboardingStep);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-8">
      {/* Step indicator */}
      <StepIndicator currentStep={step} />

      {/* Step content */}
      <div className="rounded-lg border border-border bg-card p-6 sm:p-8">
        {step === 0 && <WelcomeStep onNext={goNext} />}
        {step === 1 && (
          <PlatformStep
            connectedPlatforms={connectedPlatforms}
            onToggle={togglePlatform}
            onNext={goNext}
            onBack={goBack}
          />
        )}
        {step === 2 && <CampaignStep onNext={goNext} onBack={goBack} />}
        {step === 3 && <CompletionStep />}
      </div>
    </div>
  );
}
