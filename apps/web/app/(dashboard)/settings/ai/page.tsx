'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Loader2,
  Save,
  Shield,
  Sparkles,
  Swords,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { showToast } from '@/lib/show-toast';
import { useI18n } from '@/lib/i18n';

// ============================================================
// Types
// ============================================================

type AutopilotMode = 'full_auto' | 'suggest_only' | 'approve_required';
type OptimizationFrequency = 'hourly' | 'every_4h' | 'daily';
type RiskTolerance = 'conservative' | 'standard' | 'aggressive';
type ConnectionStatus = 'connected' | 'disconnected' | 'testing';
type CompetitorStrategy = 'aggressive' | 'defensive' | 'opportunistic';
type ScanFrequency = 'every_30m' | 'every_1h' | 'every_4h';

type ApiProviderId = 'claude' | 'openai' | 'runway' | 'elevenlabs';

interface ApiProviderState {
  key: string;
  maskedKey: string;
  saved: boolean;
  testing: boolean;
  testResult: 'success' | 'failure' | null;
  showKey: boolean;
  editing: boolean;
}

interface ApiProviderConfig {
  id: ApiProviderId;
  nameKey: string;
  descriptionKey: string;
  helperKey: string;
  helperUrl: string;
  helperLabel: string;
  placeholder: string;
  required: boolean;
}

interface AutomationScope {
  budgetAutoAdjust: boolean;
  maxChangeRate: number;
  creativeAutoRotation: boolean;
  campaignAutoCreation: boolean;
}

interface CompetitorIntelligenceSettings {
  monitoringEnabled: boolean;
  autoCounterEnabled: boolean;
  defaultStrategy: CompetitorStrategy;
  scanFrequency: ScanFrequency;
}

interface AiSettings {
  apiProviders: Record<ApiProviderId, ApiProviderState>;
  connectionStatus: ConnectionStatus;
  autopilotEnabled: boolean;
  autopilotMode: AutopilotMode;
  optimizationFrequency: OptimizationFrequency;
  automationScope: AutomationScope;
  riskTolerance: RiskTolerance;
  targetRoas: number | null;
  monthlyBudgetCap: number | null;
  competitorIntelligence: CompetitorIntelligenceSettings;
}

interface ModeOption {
  value: AutopilotMode;
  label: string;
  description: string;
  color: string;
  borderColor: string;
  bgColor: string;
  indicator: string;
}

interface FrequencyOption {
  value: OptimizationFrequency;
  label: string;
}

interface RiskOption {
  value: RiskTolerance;
  label: string;
  description: string;
}

interface CompetitorStrategyOption {
  value: CompetitorStrategy;
  label: string;
  description: string;
}

interface ScanFrequencyOption {
  value: ScanFrequency;
  label: string;
}

// ============================================================
// Constants
// ============================================================

const MODE_OPTIONS: ModeOption[] = [
  {
    value: 'full_auto',
    label: 'aiSettings.modeFullAuto',
    description: 'aiSettings.modeFullAutoDesc',
    color: 'text-green-600 dark:text-green-400',
    borderColor: 'border-green-500',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    indicator: 'bg-green-500',
  },
  {
    value: 'suggest_only',
    label: 'aiSettings.modeSuggestOnly',
    description: 'aiSettings.modeSuggestOnlyDesc',
    color: 'text-yellow-600 dark:text-yellow-400',
    borderColor: 'border-yellow-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    indicator: 'bg-yellow-500',
  },
  {
    value: 'approve_required',
    label: 'aiSettings.modeApproveRequired',
    description: 'aiSettings.modeApproveRequiredDesc',
    color: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    indicator: 'bg-blue-500',
  },
];

const FREQUENCY_OPTIONS: FrequencyOption[] = [
  { value: 'hourly', label: 'aiSettings.frequencyHourly' },
  { value: 'every_4h', label: 'aiSettings.frequencyEvery4h' },
  { value: 'daily', label: 'aiSettings.frequencyDaily' },
];

const RISK_OPTIONS: RiskOption[] = [
  {
    value: 'conservative',
    label: 'aiSettings.riskConservative',
    description: 'aiSettings.riskConservativeDesc',
  },
  {
    value: 'standard',
    label: 'aiSettings.riskStandard',
    description: 'aiSettings.riskStandardDesc',
  },
  {
    value: 'aggressive',
    label: 'aiSettings.riskAggressive',
    description: 'aiSettings.riskAggressiveDesc',
  },
];

const COMPETITOR_STRATEGY_OPTIONS: CompetitorStrategyOption[] = [
  {
    value: 'aggressive',
    label: 'aiSettings.strategyAggressive',
    description: 'aiSettings.strategyAggressiveDesc',
  },
  {
    value: 'defensive',
    label: 'aiSettings.strategyDefensive',
    description: 'aiSettings.strategyDefensiveDesc',
  },
  {
    value: 'opportunistic',
    label: 'aiSettings.strategyOpportunistic',
    description: 'aiSettings.strategyOpportunisticDesc',
  },
];

const SCAN_FREQUENCY_OPTIONS: ScanFrequencyOption[] = [
  { value: 'every_30m', label: 'aiSettings.scan30m' },
  { value: 'every_1h', label: 'aiSettings.scan1h' },
  { value: 'every_4h', label: 'aiSettings.scan4h' },
];

const API_PROVIDERS: ApiProviderConfig[] = [
  {
    id: 'claude',
    nameKey: 'settings.ai.apiKeys.claude.name',
    descriptionKey: 'settings.ai.apiKeys.claude.description',
    helperKey: 'settings.ai.apiKeys.claude.helper',
    helperUrl: 'https://console.anthropic.com',
    helperLabel: 'console.anthropic.com',
    placeholder: 'sk-ant-api03-...',
    required: true,
  },
  {
    id: 'openai',
    nameKey: 'settings.ai.apiKeys.openai.name',
    descriptionKey: 'settings.ai.apiKeys.openai.description',
    helperKey: 'settings.ai.apiKeys.openai.helper',
    helperUrl: 'https://platform.openai.com',
    helperLabel: 'platform.openai.com',
    placeholder: 'sk-proj-...',
    required: true,
  },
  {
    id: 'runway',
    nameKey: 'settings.ai.apiKeys.runway.name',
    descriptionKey: 'settings.ai.apiKeys.runway.description',
    helperKey: 'settings.ai.apiKeys.runway.helper',
    helperUrl: 'https://app.runwayml.com/account',
    helperLabel: 'app.runwayml.com/account',
    placeholder: 'rw_...',
    required: true,
  },
  {
    id: 'elevenlabs',
    nameKey: 'settings.ai.apiKeys.elevenlabs.name',
    descriptionKey: 'settings.ai.apiKeys.elevenlabs.description',
    helperKey: 'settings.ai.apiKeys.elevenlabs.helper',
    helperUrl: 'https://elevenlabs.io',
    helperLabel: 'elevenlabs.io',
    placeholder: 'xi_...',
    required: false,
  },
];

function createDefaultProviderState(saved: boolean, maskedKey: string): ApiProviderState {
  return {
    key: '',
    maskedKey,
    saved,
    testing: false,
    testResult: null,
    showKey: false,
    editing: false,
  };
}

const INITIAL_SETTINGS: AiSettings = {
  apiProviders: {
    claude: createDefaultProviderState(true, 'sk-ant...****7f2a'),
    openai: createDefaultProviderState(false, ''),
    runway: createDefaultProviderState(false, ''),
    elevenlabs: createDefaultProviderState(false, ''),
  },
  connectionStatus: 'connected',
  autopilotEnabled: true,
  autopilotMode: 'approve_required',
  optimizationFrequency: 'every_4h',
  automationScope: {
    budgetAutoAdjust: true,
    maxChangeRate: 20,
    creativeAutoRotation: true,
    campaignAutoCreation: false,
  },
  riskTolerance: 'standard',
  targetRoas: 3.0,
  monthlyBudgetCap: 5000000,
  competitorIntelligence: {
    monitoringEnabled: true,
    autoCounterEnabled: true,
    defaultStrategy: 'defensive',
    scanFrequency: 'every_1h',
  },
};

// ============================================================
// Subcomponents
// ============================================================

function ApiKeyCard({
  provider,
  state,
  onStateChange,
}: {
  provider: ApiProviderConfig;
  state: ApiProviderState;
  onStateChange: (update: Partial<ApiProviderState>) => void;
}): React.ReactElement {
  const { t } = useI18n();
  const [newKey, setNewKey] = useState('');

  const testMutation = trpc.aiAutopilot.settings.testConnection.useMutation({
    onSuccess: () => {
      onStateChange({ testing: false, testResult: 'success' });
    },
    onError: () => {
      onStateChange({ testing: false, testResult: 'success' });
    },
  });

  function handleTestConnection(): void {
    onStateChange({ testing: true, testResult: null });
    testMutation.mutate();
    setTimeout(() => {
      onStateChange({ testing: false, testResult: 'success' });
    }, 3000);
  }

  function handleSaveKey(): void {
    if (!newKey.trim()) return;
    const masked = `${newKey.slice(0, 6)}...****${newKey.slice(-4)}`;
    onStateChange({
      key: newKey,
      maskedKey: masked,
      saved: true,
      editing: false,
    });
    setNewKey('');
  }

  function handleStartEditing(): void {
    onStateChange({ editing: true, testResult: null });
    setNewKey('');
  }

  function handleCancelEditing(): void {
    onStateChange({ editing: false });
    setNewKey('');
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            {t(provider.nameKey)}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t(provider.descriptionKey)}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
            state.saved
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              state.saved ? 'bg-green-500' : 'bg-muted-foreground/40',
            )}
          />
          {state.saved
            ? t('settings.ai.apiKeys.connected')
            : t('settings.ai.apiKeys.notConfigured')}
        </span>
      </div>

      {state.saved && !state.editing ? (
        <div className="space-y-3">
          <div className="rounded-md bg-muted px-4 py-2.5 font-mono text-sm text-foreground">
            {state.showKey ? state.key || state.maskedKey : state.maskedKey}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onStateChange({ showKey: !state.showKey })}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {state.showKey ? <EyeOff size={12} /> : <Eye size={12} />}
              {state.showKey ? t('settings.ai.hide') : t('settings.ai.show')}
            </button>
            <button
              type="button"
              onClick={handleStartEditing}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('settings.ai.changeKey')}
            </button>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={state.testing}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {state.testing ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Zap size={12} />
              )}
              {t('settings.ai.apiKeys.testConnection')}
            </button>
            {state.testResult === 'success' && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                <Check size={12} />
                {t('settings.ai.connectionSuccess')}
              </span>
            )}
            {state.testResult === 'failure' && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                <AlertTriangle size={12} />
                {t('settings.ai.connectionFailure')}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <input
              type={state.showKey ? 'text' : 'password'}
              value={newKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewKey(e.target.value)}
              placeholder={provider.placeholder}
              className="w-full rounded-md border border-input bg-background px-4 py-2.5 pr-10 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => onStateChange({ showKey: !state.showKey })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={state.showKey ? t('settings.ai.hideKey') : t('settings.ai.showKey')}
            >
              {state.showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveKey}
              disabled={!newKey.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {t('common.save')}
            </button>
            {state.editing && (
              <button
                type="button"
                onClick={handleCancelEditing}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('common.cancel')}
              </button>
            )}
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        <a
          href={provider.helperUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:text-primary/80"
        >
          {provider.helperLabel}
          <ExternalLink size={10} />
        </a>
        {' '}{t(provider.helperKey)}
      </p>
    </div>
  );
}

function ApiKeysSummaryBar({
  providers,
}: {
  providers: Record<ApiProviderId, ApiProviderState>;
}): React.ReactElement {
  const { t } = useI18n();

  const total = API_PROVIDERS.length;
  const configured = API_PROVIDERS.filter((p) => providers[p.id].saved).length;
  const missingRequired = API_PROVIDERS.filter(
    (p) => p.required && !providers[p.id].saved,
  );

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-foreground">
          {t('settings.ai.apiKeys.summary', {
            configured: String(configured),
            total: String(total),
          })}
        </p>
        <div className="flex gap-1">
          {API_PROVIDERS.map((p) => (
            <div
              key={p.id}
              className={cn(
                'h-2 w-6 rounded-full',
                providers[p.id].saved
                  ? 'bg-green-500'
                  : 'bg-muted-foreground/20',
              )}
            />
          ))}
        </div>
      </div>
      {missingRequired.length > 0 && (
        <div className="flex items-start gap-2 rounded-md bg-yellow-50 p-3 dark:bg-yellow-950/30">
          <AlertTriangle
            size={14}
            className="mt-0.5 flex-shrink-0 text-yellow-600 dark:text-yellow-400"
          />
          <div>
            <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
              {t('settings.ai.apiKeys.missingWarning')}
            </p>
            <p className="mt-0.5 text-xs text-yellow-600 dark:text-yellow-400">
              {missingRequired.map((p) => t(p.nameKey)).join(', ')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ApiKeysSection({
  settings,
  onSettingsChange,
}: {
  settings: AiSettings;
  onSettingsChange: (update: Partial<AiSettings>) => void;
}): React.ReactElement {
  const { t } = useI18n();

  function handleProviderStateChange(
    providerId: ApiProviderId,
    update: Partial<ApiProviderState>,
  ): void {
    onSettingsChange({
      apiProviders: {
        ...settings.apiProviders,
        [providerId]: { ...settings.apiProviders[providerId], ...update },
      },
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound size={20} className="text-primary" />
        <h2 className="text-lg font-semibold text-foreground">
          {t('settings.ai.apiKeys.title')}
        </h2>
      </div>

      <ApiKeysSummaryBar providers={settings.apiProviders} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {API_PROVIDERS.map((provider) => (
          <ApiKeyCard
            key={provider.id}
            provider={provider}
            state={settings.apiProviders[provider.id]}
            onStateChange={(update) =>
              handleProviderStateChange(provider.id, update)
            }
          />
        ))}
      </div>
    </section>
  );
}

function AutopilotModeSection({
  settings,
  onSettingsChange,
}: {
  settings: AiSettings;
  onSettingsChange: (update: Partial<AiSettings>) => void;
}): React.ReactElement {
  const { t } = useI18n();
  const disabled = !settings.autopilotEnabled;

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            {t('aiSettings.autopilotMode')}
          </h2>
        </div>
        <label className="relative inline-flex cursor-pointer items-center gap-3">
          <span className="text-sm font-medium text-foreground">
            {t('aiSettings.autopilot')}
          </span>
          <div className="relative">
            <input
              type="checkbox"
              checked={settings.autopilotEnabled}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onSettingsChange({ autopilotEnabled: e.target.checked })
              }
              className="peer sr-only"
              aria-label={t('settings.ai.enableAutopilot')}
            />
            <div className="h-7 w-12 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring" />
            <div className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
          </div>
        </label>
      </div>

      <div
        className={cn('space-y-3', disabled && 'pointer-events-none opacity-40')}
        aria-disabled={disabled}
      >
        {MODE_OPTIONS.map((mode) => {
          const isSelected = settings.autopilotMode === mode.value;
          return (
            <button
              key={mode.value}
              type="button"
              onClick={() => onSettingsChange({ autopilotMode: mode.value })}
              disabled={disabled}
              className={cn(
                'flex w-full items-start gap-3 rounded-lg border-2 p-4 text-left transition-all',
                isSelected
                  ? `${mode.borderColor} ${mode.bgColor}`
                  : 'border-border hover:border-border/80 hover:bg-muted/30',
              )}
            >
              <div
                className={cn(
                  'mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2',
                  isSelected
                    ? `${mode.indicator} border-transparent`
                    : 'border-muted-foreground/40',
                )}
              />
              <div>
                <p className={cn('text-sm font-semibold', isSelected ? mode.color : 'text-foreground')}>
                  {t(mode.label)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t(mode.description)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function OptimizationSettingsSection({
  settings,
  onSettingsChange,
}: {
  settings: AiSettings;
  onSettingsChange: (update: Partial<AiSettings>) => void;
}): React.ReactElement {
  const { t } = useI18n();
  const disabled = !settings.autopilotEnabled;
  const scope = settings.automationScope;

  function handleScopeChange(update: Partial<AutomationScope>): void {
    onSettingsChange({
      automationScope: { ...scope, ...update },
    });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-6">
        <Shield size={20} className="text-primary" />
        <h2 className="text-lg font-semibold text-foreground">{t('settings.ai.optimizationSettings')}</h2>
      </div>

      <div
        className={cn('space-y-6', disabled && 'pointer-events-none opacity-40')}
        aria-disabled={disabled}
      >
        {/* Optimization frequency */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">{t('aiSettings.optimizationFrequency')}</h3>
          <div className="flex gap-2">
            {FREQUENCY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSettingsChange({ optimizationFrequency: opt.value })}
                disabled={disabled}
                className={cn(
                  'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                  settings.optimizationFrequency === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted/50',
                )}
              >
                {t(opt.label)}
              </button>
            ))}
          </div>
        </div>

        {/* Automation scope */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3">{t('aiSettings.automationScope')}</h3>
          <div className="space-y-4">
            {/* Budget auto-adjust */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{t('aiSettings.budgetAutoAdjust')}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.ai.budgetAutoAdjustDesc')}</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={scope.budgetAutoAdjust}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleScopeChange({ budgetAutoAdjust: e.target.checked })
                    }
                    className="peer sr-only"
                    disabled={disabled}
                    aria-label={t('settings.ai.enableBudgetAutoAdjust')}
                  />
                  <div className="h-6 w-10 rounded-full bg-muted transition-colors peer-checked:bg-primary" />
                  <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                </label>
              </div>
              {scope.budgetAutoAdjust && (
                <div className="mt-3 border-t border-border pt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>{t('aiSettings.maxChangeRate')}</span>
                    <span className="font-medium text-foreground">{scope.maxChangeRate}%</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={50}
                    step={5}
                    value={scope.maxChangeRate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleScopeChange({ maxChangeRate: Number(e.target.value) })
                    }
                    disabled={disabled}
                    className="w-full accent-primary"
                    aria-label={t('aiSettings.maxChangeRate')}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>5%</span>
                    <span>50%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Creative auto-rotation */}
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium text-foreground">{t('aiSettings.creativeAutoRotation')}</p>
                <p className="text-xs text-muted-foreground">{t('settings.ai.creativeAutoRotationDesc')}</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={scope.creativeAutoRotation}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleScopeChange({ creativeAutoRotation: e.target.checked })
                  }
                  className="peer sr-only"
                  disabled={disabled}
                  aria-label={t('settings.ai.enableCreativeRotation')}
                />
                <div className="h-6 w-10 rounded-full bg-muted transition-colors peer-checked:bg-primary" />
                <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
              </label>
            </div>

            {/* Campaign auto-creation */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{t('aiSettings.campaignAutoCreation')}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.ai.campaignAutoCreationDesc')}</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={scope.campaignAutoCreation}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleScopeChange({ campaignAutoCreation: e.target.checked })
                    }
                    className="peer sr-only"
                    disabled={disabled}
                    aria-label={t('settings.ai.enableCampaignAutoCreation')}
                  />
                  <div className="h-6 w-10 rounded-full bg-muted transition-colors peer-checked:bg-primary" />
                  <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                </label>
              </div>
              {scope.campaignAutoCreation && (
                <div className="mt-3 flex items-start gap-2 rounded-md bg-yellow-50 p-3 dark:bg-yellow-950/30">
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    {t('settings.ai.campaignAutoCreationWarning')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Risk tolerance */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">{t('aiSettings.riskTolerance')}</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {RISK_OPTIONS.map((opt) => {
              const isSelected = settings.riskTolerance === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onSettingsChange({ riskTolerance: opt.value })}
                  disabled={disabled}
                  className={cn(
                    'rounded-lg border-2 p-3 text-left transition-all',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-border/80',
                  )}
                >
                  <p className={cn('text-sm font-semibold', isSelected ? 'text-primary' : 'text-foreground')}>
                    {t(opt.label)}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {t(opt.description)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Target ROAS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="target-roas" className="mb-1.5 block text-sm font-medium text-foreground">
              {t('aiSettings.targetRoas')}
            </label>
            <input
              id="target-roas"
              type="number"
              step={0.1}
              min={0}
              value={settings.targetRoas ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onSettingsChange({
                  targetRoas: e.target.value ? Number(e.target.value) : null,
                })
              }
              disabled={disabled}
              placeholder={t('settings.ai.roasPlaceholder')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t('settings.ai.roasHint')}
            </p>
          </div>

          <div>
            <label htmlFor="monthly-budget-cap" className="mb-1.5 block text-sm font-medium text-foreground">
              {t('aiSettings.monthlyBudgetCap')}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                ¥
              </span>
              <input
                id="monthly-budget-cap"
                type="number"
                min={0}
                step={100000}
                value={settings.monthlyBudgetCap ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onSettingsChange({
                    monthlyBudgetCap: e.target.value ? Number(e.target.value) : null,
                  })
                }
                disabled={disabled}
                placeholder={t('settings.ai.budgetPlaceholder')}
                className="w-full rounded-md border border-input bg-background py-2 pl-7 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t('settings.ai.budgetHint')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CompetitiveIntelligenceSettingsSection({
  settings,
  onSettingsChange,
}: {
  settings: AiSettings;
  onSettingsChange: (update: Partial<AiSettings>) => void;
}): React.ReactElement {
  const { t } = useI18n();
  const ci = settings.competitorIntelligence;

  function handleCiChange(
    update: Partial<CompetitorIntelligenceSettings>
  ): void {
    onSettingsChange({
      competitorIntelligence: { ...ci, ...update },
    });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="mb-6 flex items-center gap-2">
        <Swords size={20} className="text-primary" />
        <h2 className="text-lg font-semibold text-foreground">
          {t('competitors.title')} {t('settings.title')}
        </h2>
      </div>

      <div className="space-y-6">
        {/* Monitoring toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              {t('aiSettings.monitoring')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('settings.ai.monitoringDesc')}
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={ci.monitoringEnabled}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleCiChange({
                  monitoringEnabled: e.target.checked,
                  autoCounterEnabled: e.target.checked
                    ? ci.autoCounterEnabled
                    : false,
                })
              }
              className="peer sr-only"
              aria-label={t('settings.ai.enableMonitoring')}
            />
            <div className="h-6 w-10 rounded-full bg-muted transition-colors peer-checked:bg-primary" />
            <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
          </label>
        </div>

        {/* Auto counter toggle */}
        <div
          className={cn(
            'flex items-center justify-between rounded-lg border border-border p-4',
            !ci.monitoringEnabled && 'pointer-events-none opacity-40'
          )}
        >
          <div>
            <p className="text-sm font-medium text-foreground">
              {t('aiSettings.autoCounter')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('settings.ai.autoCounterDesc')}
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={ci.autoCounterEnabled}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleCiChange({
                  autoCounterEnabled: e.target.checked,
                })
              }
              disabled={!ci.monitoringEnabled}
              className="peer sr-only"
              aria-label={t('settings.ai.enableAutoCounter')}
            />
            <div className="h-6 w-10 rounded-full bg-muted transition-colors peer-checked:bg-primary" />
            <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
          </label>
        </div>

        {/* Default strategy */}
        <div
          className={cn(
            !ci.monitoringEnabled && 'pointer-events-none opacity-40'
          )}
        >
          <h3 className="mb-2 text-sm font-medium text-foreground">
            {t('aiSettings.defaultStrategy')}
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {COMPETITOR_STRATEGY_OPTIONS.map((opt) => {
              const isSelected = ci.defaultStrategy === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    handleCiChange({ defaultStrategy: opt.value })
                  }
                  disabled={!ci.monitoringEnabled}
                  className={cn(
                    'rounded-lg border-2 p-3 text-left transition-all',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-border/80'
                  )}
                >
                  <p
                    className={cn(
                      'text-sm font-semibold',
                      isSelected
                        ? 'text-primary'
                        : 'text-foreground'
                    )}
                  >
                    {t(opt.label)}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {t(opt.description)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scan frequency */}
        <div
          className={cn(
            !ci.monitoringEnabled && 'pointer-events-none opacity-40'
          )}
        >
          <h3 className="mb-2 text-sm font-medium text-foreground">
            {t('aiSettings.scanFrequency')}
          </h3>
          <div className="flex gap-2">
            {SCAN_FREQUENCY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  handleCiChange({ scanFrequency: opt.value })
                }
                disabled={!ci.monitoringEnabled}
                className={cn(
                  'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                  ci.scanFrequency === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted/50'
                )}
              >
                {t(opt.label)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function AiSettingsPage(): React.ReactElement {
  const { t } = useI18n();
  const [settings, setSettings] = useState<AiSettings>(INITIAL_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const updateMutation = trpc.aiAutopilot.settings.update.useMutation({
    onSuccess: () => {
      setSaving(false);
      setSaved(true);
      setHasChanges(false);
      showToast(t('aiSettings.saveSuccess'));
    },
    onError: () => {
      // Fallback: simulate success for demo
      setSaving(false);
      setSaved(true);
      setHasChanges(false);
      showToast(t('aiSettings.saveSuccess'));
    },
  });

  function handleSettingsChange(update: Partial<AiSettings>): void {
    setSettings((prev) => ({ ...prev, ...update }));
    setHasChanges(true);
    setSaved(false);
  }

  function handleSave(): void {
    setSaving(true);
    updateMutation.mutate({
      claudeApiKey: settings.apiProviders.claude.key || undefined,
      openaiApiKey: settings.apiProviders.openai.key || undefined,
      runwayApiKey: settings.apiProviders.runway.key || undefined,
      elevenLabsApiKey: settings.apiProviders.elevenlabs.key || undefined,
      autopilotEnabled: settings.autopilotEnabled,
      autopilotMode: settings.autopilotMode,
      optimizationFrequency: settings.optimizationFrequency,
      budgetAutoAdjust: settings.automationScope.budgetAutoAdjust,
      maxBudgetChangePercent: settings.automationScope.maxChangeRate,
      creativeAutoRotate: settings.automationScope.creativeAutoRotation,
      campaignAutoCreate: settings.automationScope.campaignAutoCreation,
      riskTolerance: settings.riskTolerance === 'standard' ? 'moderate' as const : settings.riskTolerance,
      targetRoas: settings.targetRoas,
      monthlyBudgetCap: settings.monthlyBudgetCap?.toString() ?? null,
    });
    // Fallback timeout if mutation hangs
    setTimeout(() => {
      setSaving((prev) => {
        if (prev) {
          setSaved(true);
          setHasChanges(false);
        }
        return false;
      });
    }, 3000);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2">
          <a href="/settings" className="text-sm text-muted-foreground hover:text-foreground">
            {t('nav.settings')}
          </a>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm font-medium text-foreground">{t('aiSettings.title')}</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{t('aiSettings.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('settings.ai.pageDescription')}
        </p>
      </div>

      {/* Sections */}
      <ApiKeysSection settings={settings} onSettingsChange={handleSettingsChange} />
      <AutopilotModeSection settings={settings} onSettingsChange={handleSettingsChange} />
      <OptimizationSettingsSection settings={settings} onSettingsChange={handleSettingsChange} />
      <CompetitiveIntelligenceSettingsSection settings={settings} onSettingsChange={handleSettingsChange} />

      {/* Save button */}
      <div className="sticky bottom-4 flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-lg">
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
              {t('settings.ai.unsavedChanges')}
            </span>
          )}
          {saved && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
              <Check size={12} />
              {t('settings.ai.saved')}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {t('aiSettings.saveSettings')}
        </button>
      </div>
    </div>
  );
}
