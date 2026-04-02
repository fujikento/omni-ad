'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  BrainCircuit,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Save,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

type AutopilotMode = 'full_auto' | 'suggest_only' | 'approve_required';
type OptimizationFrequency = 'hourly' | 'every_4h' | 'daily';
type RiskTolerance = 'conservative' | 'standard' | 'aggressive';
type ConnectionStatus = 'connected' | 'disconnected' | 'testing';

interface AutomationScope {
  budgetAutoAdjust: boolean;
  maxChangeRate: number;
  creativeAutoRotation: boolean;
  campaignAutoCreation: boolean;
}

interface AiSettings {
  apiKey: string;
  maskedKey: string;
  connectionStatus: ConnectionStatus;
  autopilotEnabled: boolean;
  autopilotMode: AutopilotMode;
  optimizationFrequency: OptimizationFrequency;
  automationScope: AutomationScope;
  riskTolerance: RiskTolerance;
  targetRoas: number | null;
  monthlyBudgetCap: number | null;
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

// ============================================================
// Constants
// ============================================================

const MODE_OPTIONS: ModeOption[] = [
  {
    value: 'full_auto',
    label: '完全自動',
    description: 'AIが分析・判断・実行まで全自動で行います',
    color: 'text-green-600 dark:text-green-400',
    borderColor: 'border-green-500',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    indicator: 'bg-green-500',
  },
  {
    value: 'suggest_only',
    label: '提案モード',
    description: 'AIが分析・提案し、実行は行いません。ダッシュボードで確認できます',
    color: 'text-yellow-600 dark:text-yellow-400',
    borderColor: 'border-yellow-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    indicator: 'bg-yellow-500',
  },
  {
    value: 'approve_required',
    label: '承認モード',
    description: 'AIが分析・提案し、承認後に実行されます',
    color: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    indicator: 'bg-blue-500',
  },
];

const FREQUENCY_OPTIONS: FrequencyOption[] = [
  { value: 'hourly', label: '毎時間' },
  { value: 'every_4h', label: '4時間ごと' },
  { value: 'daily', label: '1日1回' },
];

const RISK_OPTIONS: RiskOption[] = [
  {
    value: 'conservative',
    label: '保守的',
    description: '小さな変更を段階的に実施。安全性を最優先します。',
  },
  {
    value: 'standard',
    label: '標準',
    description: 'バランスの取れた最適化。適度なリスクで成果を追求します。',
  },
  {
    value: 'aggressive',
    label: '積極的',
    description: '大胆な変更も許容。最大のリターンを狙いますがリスクも伴います。',
  },
];

const INITIAL_SETTINGS: AiSettings = {
  apiKey: '',
  maskedKey: 'sk-ant...****7f2a',
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
};

// ============================================================
// Subcomponents
// ============================================================

function ApiKeySection({
  settings,
  onSettingsChange,
}: {
  settings: AiSettings;
  onSettingsChange: (update: Partial<AiSettings>) => void;
}): React.ReactElement {
  const [showKey, setShowKey] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failure' | null>(null);

  const isConnected = settings.connectionStatus === 'connected';
  const hasSavedKey = settings.maskedKey.length > 0;

  function handleTestConnection(): void {
    setTesting(true);
    setTestResult(null);
    // Simulate API test
    setTimeout(() => {
      setTesting(false);
      setTestResult('success');
      onSettingsChange({ connectionStatus: 'connected' });
    }, 1500);
  }

  function handleSaveKey(): void {
    if (newKey.trim()) {
      onSettingsChange({
        apiKey: newKey,
        maskedKey: `${newKey.slice(0, 6)}...****${newKey.slice(-4)}`,
      });
      setEditingKey(false);
      setNewKey('');
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <BrainCircuit size={20} className="text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Claude API接続</h2>
        <span
          className={cn(
            'ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
            isConnected
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
          )}
        >
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              isConnected ? 'bg-green-500' : 'bg-red-500',
            )}
          />
          {isConnected ? '接続済み' : '未接続'}
        </span>
      </div>

      {hasSavedKey && !editingKey ? (
        <div className="space-y-3">
          <div className="rounded-md bg-muted px-4 py-3 font-mono text-sm text-foreground">
            {showKey ? settings.apiKey || settings.maskedKey : settings.maskedKey}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
              {showKey ? '隠す' : '表示'}
            </button>
            <button
              type="button"
              onClick={() => setEditingKey(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              キーを変更
            </button>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {testing ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Zap size={12} />
              )}
              接続テスト
            </button>
            {testResult === 'success' && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                <Check size={12} />
                接続成功
              </span>
            )}
            {testResult === 'failure' && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                <AlertTriangle size={12} />
                接続失敗
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={newKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewKey(e.target.value)}
              placeholder="sk-ant-api03-..."
              className="w-full rounded-md border border-input bg-background px-4 py-2.5 pr-10 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showKey ? 'キーを隠す' : 'キーを表示'}
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveKey}
              disabled={!newKey.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              保存
            </button>
            {editingKey && (
              <button
                type="button"
                onClick={() => {
                  setEditingKey(false);
                  setNewKey('');
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                キャンセル
              </button>
            )}
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        <a
          href="https://console.anthropic.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:text-primary/80"
        >
          Anthropic Console
          <ExternalLink size={10} />
        </a>
        {' '}からAPIキーを取得してください
      </p>
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
  const disabled = !settings.autopilotEnabled;

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            オートパイロットモード
          </h2>
        </div>
        <label className="relative inline-flex cursor-pointer items-center gap-3">
          <span className="text-sm font-medium text-foreground">
            AIオートパイロット
          </span>
          <div className="relative">
            <input
              type="checkbox"
              checked={settings.autopilotEnabled}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onSettingsChange({ autopilotEnabled: e.target.checked })
              }
              className="peer sr-only"
              aria-label="AIオートパイロットを有効化"
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
                  {mode.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {mode.description}
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
        <h2 className="text-lg font-semibold text-foreground">最適化設定</h2>
      </div>

      <div
        className={cn('space-y-6', disabled && 'pointer-events-none opacity-40')}
        aria-disabled={disabled}
      >
        {/* Optimization frequency */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">最適化頻度</h3>
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
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Automation scope */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3">自動化範囲</h3>
          <div className="space-y-4">
            {/* Budget auto-adjust */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">予算自動調整</p>
                  <p className="text-xs text-muted-foreground">AIが自動的に予算を調整します</p>
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
                    aria-label="予算自動調整を有効化"
                  />
                  <div className="h-6 w-10 rounded-full bg-muted transition-colors peer-checked:bg-primary" />
                  <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                </label>
              </div>
              {scope.budgetAutoAdjust && (
                <div className="mt-3 border-t border-border pt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>最大変更率</span>
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
                    aria-label="最大変更率"
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
                <p className="text-sm font-medium text-foreground">クリエイティブ自動ローテーション</p>
                <p className="text-xs text-muted-foreground">パフォーマンスに基づきクリエイティブを自動切替</p>
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
                  aria-label="クリエイティブ自動ローテーションを有効化"
                />
                <div className="h-6 w-10 rounded-full bg-muted transition-colors peer-checked:bg-primary" />
                <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
              </label>
            </div>

            {/* Campaign auto-creation */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">キャンペーン自動作成</p>
                  <p className="text-xs text-muted-foreground">AIが自動的に新しいキャンペーンを作成します</p>
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
                    aria-label="キャンペーン自動作成を有効化"
                  />
                  <div className="h-6 w-10 rounded-full bg-muted transition-colors peer-checked:bg-primary" />
                  <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                </label>
              </div>
              {scope.campaignAutoCreation && (
                <div className="mt-3 flex items-start gap-2 rounded-md bg-yellow-50 p-3 dark:bg-yellow-950/30">
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    AIが自動的に新しいキャンペーンを作成します。予算上限を設定することを強く推奨します。
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Risk tolerance */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">リスク許容度</h3>
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
                    {opt.label}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {opt.description}
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
              目標ROAS
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
              placeholder="例: 3.0"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              未設定の場合、AIが自動的に目標を設定します
            </p>
          </div>

          <div>
            <label htmlFor="monthly-budget-cap" className="mb-1.5 block text-sm font-medium text-foreground">
              月間予算上限
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
                placeholder="例: 5,000,000"
                className="w-full rounded-md border border-input bg-background py-2 pl-7 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              未設定の場合、予算上限なし
            </p>
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
  const [settings, setSettings] = useState<AiSettings>(INITIAL_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // TODO: Wire to tRPC when backend is ready
  // const { data, isLoading } = trpc.aiAutopilot.settings.get.useQuery();
  // const mutation = trpc.aiAutopilot.settings.update.useMutation();

  function handleSettingsChange(update: Partial<AiSettings>): void {
    setSettings((prev) => ({ ...prev, ...update }));
    setHasChanges(true);
    setSaved(false);
  }

  function handleSave(): void {
    setSaving(true);
    // TODO: mutation.mutate(settings)
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setHasChanges(false);
    }, 1000);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2">
          <a href="/settings" className="text-sm text-muted-foreground hover:text-foreground">
            設定
          </a>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm font-medium text-foreground">AI設定</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">AI設定</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Claude APIキーの設定とAIオートパイロットの動作を管理します
        </p>
      </div>

      {/* Sections */}
      <ApiKeySection settings={settings} onSettingsChange={handleSettingsChange} />
      <AutopilotModeSection settings={settings} onSettingsChange={handleSettingsChange} />
      <OptimizationSettingsSection settings={settings} onSettingsChange={handleSettingsChange} />

      {/* Save button */}
      <div className="sticky bottom-4 flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-lg">
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
              未保存の変更があります
            </span>
          )}
          {saved && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
              <Check size={12} />
              保存しました
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
          設定を保存
        </button>
      </div>
    </div>
  );
}
