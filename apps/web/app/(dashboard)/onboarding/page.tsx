'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronDown,
  Edit3,
  Eye,
  Globe,
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
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

type OnboardingStep = 0 | 1 | 2 | 3;
type CampaignObjective = 'awareness' | 'traffic' | 'conversion' | 'retargeting';
type ConversionGoal = 'purchase' | 'lead' | 'app_install';

interface PlatformCard {
  id: string;
  name: string;
  icon: React.ReactNode;
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

const STEPS: { label: string; number: number }[] = [
  { label: 'ようこそ', number: 1 },
  { label: 'プラットフォーム接続', number: 2 },
  { label: 'キャンペーン作成', number: 3 },
  { label: '完了', number: 4 },
];

const PLATFORMS: PlatformCard[] = [
  { id: 'meta', name: 'META (Facebook / Instagram)', icon: <Globe size={28} />, color: 'border-indigo-200 hover:border-indigo-400 dark:border-indigo-800' },
  { id: 'google', name: 'Google Ads', icon: <Globe size={28} />, color: 'border-blue-200 hover:border-blue-400 dark:border-blue-800' },
  { id: 'x', name: 'X (Twitter)', icon: <Globe size={28} />, color: 'border-gray-200 hover:border-gray-400 dark:border-gray-700' },
  { id: 'tiktok', name: 'TikTok Ads', icon: <Globe size={28} />, color: 'border-pink-200 hover:border-pink-400 dark:border-pink-800' },
  { id: 'line_yahoo', name: 'LINE / Yahoo!', icon: <Globe size={28} />, color: 'border-green-200 hover:border-green-400 dark:border-green-800' },
  { id: 'amazon', name: 'Amazon Ads', icon: <Globe size={28} />, color: 'border-orange-200 hover:border-orange-400 dark:border-orange-800' },
  { id: 'microsoft', name: 'Microsoft Ads', icon: <Globe size={28} />, color: 'border-cyan-200 hover:border-cyan-400 dark:border-cyan-800' },
];

const CONVERSION_GOALS: { value: ConversionGoal; label: string }[] = [
  { value: 'purchase', label: 'メインサイト購入' },
  { value: 'lead', label: 'リード獲得フォーム' },
  { value: 'app_install', label: 'アプリインストール' },
];

const ONBOARDING_AGE_OPTIONS = ['18', '20', '25', '30', '35', '40', '45', '50', '55', '60', '65+'] as const;

const ONBOARDING_REGION_OPTIONS = ['東京', '大阪', '名古屋', '福岡', '札幌', '横浜', '京都', '神戸', '仙台', '広島'] as const;

const OBJECTIVES: ObjectiveCard[] = [
  { id: 'awareness', label: '認知拡大', description: 'ブランドの認知度を高め、より多くの人にリーチ', icon: <Eye size={28} className="text-blue-500" /> },
  { id: 'traffic', label: 'トラフィック', description: 'ウェブサイトやアプリへの訪問者を増やす', icon: <MousePointerClick size={28} className="text-green-500" /> },
  { id: 'conversion', label: 'コンバージョン', description: '購入やお問い合わせなどの成果を最大化', icon: <ShoppingCart size={28} className="text-purple-500" /> },
  { id: 'retargeting', label: 'リターゲティング', description: '過去の訪問者に再度アプローチし、CV率向上', icon: <RefreshCcw size={28} className="text-orange-500" /> },
];

// ============================================================
// Subcomponents
// ============================================================

function StepIndicator({ currentStep }: { currentStep: OnboardingStep }): React.ReactElement {
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
              {step.label}
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
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
        <Rocket size={40} className="text-primary" />
      </div>
      <h2 className="mt-6 text-2xl font-bold text-foreground">
        ようこそ OMNI-AD へ
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        AIを活用した統合マーケティングプラットフォームで、すべての広告チャネルを一元管理しましょう。
      </p>

      <div className="mt-8 grid w-full max-w-lg grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <Megaphone size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">統合管理</p>
          <p className="mt-1 text-xs text-muted-foreground">7つの広告プラットフォームを一画面で管理</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
            <BrainCircuit size={20} className="text-purple-600 dark:text-purple-400" />
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">AI最適化</p>
          <p className="mt-1 text-xs text-muted-foreground">AIが予算配分とクリエイティブを自動最適化</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <BarChart3 size={20} className="text-green-600 dark:text-green-400" />
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">統合分析</p>
          <p className="mt-1 text-xs text-muted-foreground">クロスチャネルのROASをリアルタイム分析</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="mt-8 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        セットアップを開始
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
  return (
    <div>
      <h2 className="text-xl font-bold text-foreground">プラットフォーム接続</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        広告アカウントを接続して、統合管理を開始しましょう。
      </p>
      <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
        最低1つ接続してください
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((platform) => {
          const isConnected = connectedPlatforms.has(platform.id);
          return (
            <button
              key={platform.id}
              type="button"
              onClick={() => onToggle(platform.id)}
              className={cn(
                'flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all',
                isConnected
                  ? 'border-primary bg-primary/5'
                  : platform.color,
              )}
            >
              <div className={cn(
                'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg',
                isConnected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
              )}>
                {platform.icon}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{platform.name}</p>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <Check size={12} />
                    接続済み
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">接続する</span>
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
          戻る
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onNext}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            スキップ（後で設定）
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={connectedPlatforms.size === 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            次へ
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
        objective: 'コンバージョン最大化',
        targeting: '20-35歳女性、東京・大阪・名古屋、スキンケア・美容に興味あり',
        budget: '日次 ¥16,000 / 月間 ¥500,000 (Google 40%, Meta 35%, TikTok 25%)',
        creative: '動画広告3本 + 静止画カルーセル2セット (AIが自動生成)',
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
      <h2 className="text-xl font-bold text-foreground">最初のキャンペーン作成</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        最初のキャンペーンを設定しましょう。後からいつでも変更できます。
      </p>

      {/* AI Campaign Architect toggle */}
      <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            <span className="text-sm font-semibold text-foreground">AI Campaign Architect</span>
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
            aria-label="AIキャンペーン設計を有効にする"
          >
            <span className={cn(
              'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
              aiMode && 'translate-x-5',
            )} />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          目標を入力するだけでAIが最適なキャンペーンを設計します
        </p>
        {aiMode && !aiPlan && (
          <div className="mt-3 space-y-3">
            <label htmlFor="business-goal" className="sr-only">ビジネス目標</label>
            <textarea
              id="business-goal"
              value={businessGoal}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBusinessGoal(e.target.value)}
              className={inputCls}
              rows={3}
              placeholder="例: 新しいスキンケア製品のオンライン販売を月間100件達成したい。ターゲットは20-35歳の女性。予算は月50万円。"
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
              {aiGenerating ? 'AI分析中...' : 'AIで設計'}
            </button>
          </div>
        )}

        {/* AI Generated Plan Display */}
        {aiMode && aiPlan && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Check size={16} className="text-green-500" />
              <span className="text-sm font-semibold text-green-600">キャンペーンプラン生成完了</span>
            </div>
            {(Object.entries(aiPlan) as [keyof AiGeneratedPlan, string][]).map(([key, value]) => {
              const fieldLabels: Record<keyof AiGeneratedPlan, string> = {
                objective: '目的',
                targeting: 'ターゲティング',
                budget: '予算配分',
                creative: 'クリエイティブ',
                platforms: 'プラットフォーム',
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
                      aria-label={`${fieldLabels[key]}を編集`}
                    >
                      <Edit3 size={10} />
                      {isEditing ? '完了' : '編集'}
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
              再生成する
            </button>
          </div>
        )}
      </div>

      {!aiMode && (
        <div className="mt-6 space-y-6">
          {/* Campaign name */}
          <div>
            <label htmlFor="onboarding-campaign-name" className={labelCls}>
              キャンペーン名
            </label>
            <input
              id="onboarding-campaign-name"
              type="text"
              value={campaignName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCampaignName(e.target.value)}
              className={inputCls}
              placeholder="春のプロモーションキャンペーン"
            />
          </div>

          {/* Objective selection */}
          <div>
            <span className="mb-2 block text-sm font-medium text-foreground">目的</span>
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
                    <p className="text-sm font-semibold text-foreground">{obj.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{obj.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div>
            <label htmlFor="onboarding-budget" className={labelCls}>
              月間予算 (JPY)
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
                ランディングページURL
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
                コンバージョンゴール
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
                  <option key={cg.value} value={cg.value}>{cg.label}</option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Target CPA / ROAS */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="onboarding-target-cpa" className={labelCls}>目標CPA (JPY)</label>
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
              <label htmlFor="onboarding-target-roas" className={labelCls}>目標ROAS (倍)</label>
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
              基本ターゲティング
            </h4>

            {/* Age range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="onboarding-age-min" className={labelCls}>年齢（下限）</label>
                <div className="relative">
                  <select
                    id="onboarding-age-min"
                    value={ageMin}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAgeMin(e.target.value)}
                    className={cn(inputCls, 'appearance-none pr-8')}
                  >
                    {ONBOARDING_AGE_OPTIONS.map((age) => (
                      <option key={age} value={age}>{age}歳</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <div>
                <label htmlFor="onboarding-age-max" className={labelCls}>年齢（上限）</label>
                <div className="relative">
                  <select
                    id="onboarding-age-max"
                    value={ageMax}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAgeMax(e.target.value)}
                    className={cn(inputCls, 'appearance-none pr-8')}
                  >
                    {ONBOARDING_AGE_OPTIONS.map((age) => (
                      <option key={age} value={age}>{age}歳</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* Region */}
            <div className="mt-3">
              <span className={labelCls}>地域</span>
              <div className="flex flex-wrap gap-1.5">
                {ONBOARDING_REGION_OPTIONS.map((region) => (
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
          戻る
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          完了
          <Check size={16} />
        </button>
      </div>
    </div>
  );
}

function CompletionStep(): React.ReactElement {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
        <Check size={40} className="text-green-600 dark:text-green-400" />
      </div>
      <h2 className="mt-6 text-2xl font-bold text-foreground">
        セットアップ完了！
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        OMNI-ADの準備が整いました。AIがあなたのマーケティングを強力にサポートします。
      </p>

      <div className="mt-8 grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-3">
        <a
          href="/"
          className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-muted/30"
        >
          <Home size={24} className="text-primary" />
          <span className="text-sm font-medium text-foreground">ダッシュボード</span>
        </a>
        <a
          href="/campaigns"
          className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-muted/30"
        >
          <LayoutDashboard size={24} className="text-primary" />
          <span className="text-sm font-medium text-foreground">キャンペーン管理</span>
        </a>
        <a
          href="/analytics"
          className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-muted/30"
        >
          <BarChart3 size={24} className="text-primary" />
          <span className="text-sm font-medium text-foreground">分析</span>
        </a>
      </div>

      <button
        type="button"
        className="mt-6 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        <Users size={16} />
        ツアーを見る
      </button>
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
