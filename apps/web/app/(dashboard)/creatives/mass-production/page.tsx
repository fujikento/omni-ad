'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Image,
  Loader2,
  Rocket,
  Sparkles,
  Square,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

type Language = 'ja' | 'en';
type KeigoLevel = 'casual' | 'polite' | 'formal';
type StepNumber = 1 | 2 | 3;
type BatchStatus = 'idle' | 'generating' | 'completed' | 'cancelled';

type Platform = 'meta' | 'google' | 'tiktok' | 'line_yahoo' | 'x' | 'amazon' | 'microsoft';

interface ProductInfo {
  name: string;
  description: string;
  usp: string;
  targetAudience: string;
  price: string;
  language: Language;
  keigoLevel: KeigoLevel;
}

interface GeneratedCreative {
  id: string;
  headline: string;
  body: string;
  cta: string;
  imageStyle: string;
  platform: string;
  score: number;
}

interface BatchProgress {
  status: BatchStatus;
  total: number;
  completed: number;
  speed: number;
  creatives: GeneratedCreative[];
}

// ============================================================
// Constants
// ============================================================

const HEADLINE_ANGLES = [
  { id: 'problem', label: '問題提起型', example: '〇〇でお困りではありませんか？' },
  { id: 'number', label: '数字訴求型', example: '月間100件の実績' },
  { id: 'testimonial', label: '証言型', example: '利用者の声' },
  { id: 'urgency', label: '緊急性型', example: '今だけ限定' },
  { id: 'comparison', label: '比較型', example: '他社との違い' },
  { id: 'humor', label: 'ユーモア型', example: '意外な事実' },
  { id: 'fomo', label: 'FOMO型', example: '残りわずか' },
  { id: 'authority', label: '権威性型', example: '専門家推薦' },
] as const;

const BODY_APPROACHES = [
  { id: 'benefit', label: 'ベネフィット重視' },
  { id: 'feature', label: '機能説明' },
  { id: 'story', label: 'ストーリー形式' },
  { id: 'question', label: '質問形式' },
] as const;

const CTA_VARIATIONS = [
  { id: 'start-now', label: '今すぐ始める' },
  { id: 'free-trial', label: '無料で試す' },
  { id: 'details', label: '詳細を見る' },
  { id: 'request', label: '資料請求' },
  { id: 'contact', label: 'お問い合わせ' },
] as const;

const IMAGE_STYLES = [
  { id: 'professional', label: 'プロフェッショナル' },
  { id: 'lifestyle', label: 'ライフスタイル' },
  { id: 'minimal', label: 'ミニマル' },
  { id: 'bold', label: 'ボールド' },
  { id: 'text-heavy', label: 'テキスト重視' },
] as const;

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: 'meta', label: 'Meta' },
  { id: 'google', label: 'Google' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'line_yahoo', label: 'LINE/Yahoo' },
  { id: 'x', label: 'X' },
  { id: 'amazon', label: 'Amazon' },
  { id: 'microsoft', label: 'Microsoft' },
];

const STEPS: { step: StepNumber; label: string }[] = [
  { step: 1, label: '商品情報入力' },
  { step: 2, label: 'バリエーション設定' },
  { step: 3, label: '確認 & 生成開始' },
];

function generateMockCreative(index: number): GeneratedCreative {
  const headlines = [
    'コスト50%削減を実現', '今だけ限定キャンペーン', '専門家が選ぶNo.1ツール',
    'たった3分で設定完了', '利用者満足度98%', '他社比較で圧倒的な差',
    '残り僅か！早期申込割引', '知らないと損する新常識',
  ];
  const ctaOptions = ['今すぐ始める', '無料で試す', '詳細を見る', '資料請求', 'お問い合わせ'];
  const styleOptions = ['プロフェッショナル', 'ライフスタイル', 'ミニマル', 'ボールド', 'テキスト重視'];
  const platformOptions = ['Meta', 'Google', 'TikTok', 'LINE/Yahoo', 'X', 'Amazon', 'Microsoft'];

  return {
    id: `gen-${index}`,
    headline: headlines[index % headlines.length] ?? '',
    body: 'AIが自動生成した本文コピーがここに表示されます。ベネフィットを重視した訴求文です。',
    cta: ctaOptions[index % ctaOptions.length] ?? '',
    imageStyle: styleOptions[index % styleOptions.length] ?? '',
    platform: platformOptions[index % platformOptions.length] ?? '',
    score: Math.floor(Math.random() * 30) + 70,
  };
}

// ============================================================
// Subcomponents
// ============================================================

interface CheckboxGridProps {
  title: string;
  items: ReadonlyArray<{ id: string; label: string; example?: string }>;
  selected: Set<string>;
  onToggle: (id: string) => void;
}

function CheckboxGrid({ title, items, selected, onToggle }: CheckboxGridProps): React.ReactElement {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-foreground">{title}</h4>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          const isSelected = selected.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className={cn(
                'flex items-start gap-2 rounded-lg border p-3 text-left transition-colors',
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-primary/40',
              )}
              aria-pressed={isSelected}
            >
              <span className="mt-0.5 flex-shrink-0">
                {isSelected ? (
                  <Check size={14} className="text-primary" />
                ) : (
                  <Square size={14} className="text-muted-foreground/40" />
                )}
              </span>
              <div className="min-w-0">
                <span className="text-sm font-medium text-foreground">{item.label}</span>
                {item.example && (
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {item.example}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface CombinationCalculatorProps {
  headlineCount: number;
  bodyCount: number;
  ctaCount: number;
  styleCount: number;
  platformCount: number;
  maxGeneration: number;
  onMaxChange: (value: number) => void;
}

function CombinationCalculator({
  headlineCount,
  bodyCount,
  ctaCount,
  styleCount,
  platformCount,
  maxGeneration,
  onMaxChange,
}: CombinationCalculatorProps): React.ReactElement {
  const totalCombinations = headlineCount * bodyCount * ctaCount * styleCount * platformCount;
  const actualGeneration = Math.min(totalCombinations, maxGeneration);

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <Zap size={16} className="text-primary" />
        <h4 className="text-sm font-semibold text-foreground">組み合わせ計算</h4>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1 text-sm text-foreground">
        <span className="rounded bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
          {headlineCount}
        </span>
        <span className="text-muted-foreground">切り口</span>
        <X size={12} className="text-muted-foreground" />
        <span className="rounded bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
          {bodyCount}
        </span>
        <span className="text-muted-foreground">アプローチ</span>
        <X size={12} className="text-muted-foreground" />
        <span className="rounded bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
          {ctaCount}
        </span>
        <span className="text-muted-foreground">CTA</span>
        <X size={12} className="text-muted-foreground" />
        <span className="rounded bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
          {styleCount}
        </span>
        <span className="text-muted-foreground">スタイル</span>
        <X size={12} className="text-muted-foreground" />
        <span className="rounded bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
          {platformCount}
        </span>
        <span className="text-muted-foreground">プラットフォーム</span>
        <span className="text-muted-foreground">=</span>
        <span className="rounded bg-primary/20 px-2 py-0.5 font-mono text-lg font-bold text-primary">
          {totalCombinations.toLocaleString()}
        </span>
        <span className="text-muted-foreground">パターン</span>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <label htmlFor="max-gen" className="text-sm font-medium text-foreground">
            生成数上限
          </label>
          <span className="font-mono text-sm font-bold text-primary">{maxGeneration}</span>
        </div>
        <input
          id="max-gen"
          type="range"
          min={50}
          max={1000}
          step={50}
          value={maxGeneration}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onMaxChange(Number(e.target.value))}
          className="mt-2 w-full accent-primary"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>50</span>
          <span>1,000</span>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        実際の生成数: <span className="font-semibold text-foreground">{actualGeneration.toLocaleString()}</span>
        {totalCombinations > maxGeneration && (
          <span> (上限適用: {totalCombinations.toLocaleString()} 中 {maxGeneration} を生成)</span>
        )}
      </p>
    </div>
  );
}

interface BatchProgressViewProps {
  progress: BatchProgress;
  onCancel: () => void;
}

function BatchProgressView({ progress, onCancel }: BatchProgressViewProps): React.ReactElement {
  const percentage = progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Progress header */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {progress.status === 'generating' ? (
              <Loader2 size={24} className="animate-spin text-primary" />
            ) : progress.status === 'completed' ? (
              <Check size={24} className="text-green-600" />
            ) : (
              <X size={24} className="text-red-500" />
            )}
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {progress.status === 'generating' && '生成中...'}
                {progress.status === 'completed' && '生成完了'}
                {progress.status === 'cancelled' && '生成キャンセル'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {progress.completed} / {progress.total} 生成済み ({percentage}%)
              </p>
            </div>
          </div>
          {progress.status === 'generating' && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              キャンセル
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              progress.status === 'completed' ? 'bg-green-500' : 'bg-primary',
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>速度: 約 {progress.speed}件/分</span>
          {progress.status === 'generating' && (
            <span>
              残り約 {Math.ceil((progress.total - progress.completed) / progress.speed)} 分
            </span>
          )}
        </div>
      </div>

      {/* Generated creatives grid */}
      {progress.creatives.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            生成済みクリエイティブ ({progress.creatives.length}件)
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {progress.creatives.map((creative) => (
              <div
                key={creative.id}
                className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/20"
              >
                {/* Thumbnail placeholder */}
                <div className="flex h-24 items-center justify-center rounded-md bg-muted/50">
                  <Image size={24} className="text-muted-foreground/30" />
                </div>
                <div className="mt-3">
                  <p className="text-sm font-semibold text-foreground line-clamp-1">
                    {creative.headline}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {creative.body}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      {creative.cta}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {creative.platform}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{creative.imageStyle}</span>
                    <span
                      className={cn(
                        'font-semibold',
                        creative.score >= 80
                          ? 'text-green-600'
                          : creative.score >= 60
                            ? 'text-yellow-600'
                            : 'text-red-600',
                      )}
                    >
                      スコア: {creative.score}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function MassProductionPage(): React.ReactElement {
  // Step management
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);

  // Step 1: Product info
  const [product, setProduct] = useState<ProductInfo>({
    name: '',
    description: '',
    usp: '',
    targetAudience: '',
    price: '',
    language: 'ja',
    keigoLevel: 'polite',
  });

  // Step 2: Variation selections
  const [selectedHeadlines, setSelectedHeadlines] = useState<Set<string>>(new Set());
  const [selectedBodies, setSelectedBodies] = useState<Set<string>>(new Set());
  const [selectedCtas, setSelectedCtas] = useState<Set<string>>(new Set());
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(new Set());
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());
  const [maxGeneration, setMaxGeneration] = useState(200);

  // Batch progress
  const [batchProgress, setBatchProgress] = useState<BatchProgress>({
    status: 'idle',
    total: 0,
    completed: 0,
    speed: 10,
    creatives: [],
  });

  function toggleSet(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string): void {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function updateProduct(field: keyof ProductInfo, value: string): void {
    setProduct((prev) => ({ ...prev, [field]: value }));
  }

  const totalCombinations =
    Math.max(1, selectedHeadlines.size) *
    Math.max(1, selectedBodies.size) *
    Math.max(1, selectedCtas.size) *
    Math.max(1, selectedStyles.size) *
    Math.max(1, selectedPlatforms.size);

  const actualGeneration = Math.min(totalCombinations, maxGeneration);
  const estimatedMinutes = Math.ceil((actualGeneration / 10) * 0.3);

  function handleStartGeneration(): void {
    const total = actualGeneration;
    setBatchProgress({
      status: 'generating',
      total,
      completed: 0,
      speed: 10,
      creatives: [],
    });

    let count = 0;
    const interval = setInterval(() => {
      count += Math.floor(Math.random() * 3) + 1;
      if (count >= total) {
        count = total;
        clearInterval(interval);
        setBatchProgress((prev) => ({
          ...prev,
          status: 'completed',
          completed: total,
          creatives: Array.from({ length: total }, (_, i) => generateMockCreative(i)),
        }));
        return;
      }

      setBatchProgress((prev) => ({
        ...prev,
        completed: count,
        creatives: Array.from({ length: count }, (_, i) => generateMockCreative(i)),
      }));
    }, 500);

    // Store interval ID for cleanup on cancel
    setBatchProgress((prev) => ({ ...prev, _intervalId: interval } as BatchProgress));
  }

  function handleCancelGeneration(): void {
    setBatchProgress((prev) => ({
      ...prev,
      status: 'cancelled',
    }));
  }

  const isStep1Valid = product.name.trim() !== '' && product.description.trim() !== '';
  const isStep2Valid =
    selectedHeadlines.size > 0 &&
    selectedBodies.size > 0 &&
    selectedCtas.size > 0 &&
    selectedStyles.size > 0 &&
    selectedPlatforms.size > 0;

  // If batch is running or completed, show progress view
  if (batchProgress.status !== 'idle') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setBatchProgress({ status: 'idle', total: 0, completed: 0, speed: 10, creatives: [] })}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="戻る"
            disabled={batchProgress.status === 'generating'}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              AI クリエイティブ大量生産
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              バッチ生成の進捗状況
            </p>
          </div>
        </div>
        <BatchProgressView progress={batchProgress} onCancel={handleCancelGeneration} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/creatives"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="クリエイティブ一覧へ戻る"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            AI クリエイティブ大量生産
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            1つの商品情報から数百パターンのクリエイティブをAIが自動生成します
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, idx) => (
          <div key={s.step} className="flex items-center gap-2">
            {idx > 0 && (
              <ChevronRight size={14} className="text-muted-foreground" />
            )}
            <button
              type="button"
              onClick={() => {
                if (s.step < currentStep) setCurrentStep(s.step);
              }}
              disabled={s.step > currentStep}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                currentStep === s.step
                  ? 'bg-primary text-primary-foreground'
                  : s.step < currentStep
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                {s.step < currentStep ? <Check size={12} /> : s.step}
              </span>
              {s.label}
            </button>
          </div>
        ))}
      </div>

      {/* Step 1: Product info */}
      {currentStep === 1 && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">商品情報入力</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            AIがクリエイティブを生成するための基本情報を入力してください
          </p>
          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor="mp-product-name" className="mb-1 block text-sm font-medium text-foreground">
                商品名 <span className="text-destructive">*</span>
              </label>
              <input
                id="mp-product-name"
                type="text"
                value={product.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateProduct('name', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="OMNI-AD マーケティングプラットフォーム"
              />
            </div>
            <div>
              <label htmlFor="mp-description" className="mb-1 block text-sm font-medium text-foreground">
                商品説明 <span className="text-destructive">*</span>
              </label>
              <textarea
                id="mp-description"
                value={product.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateProduct('description', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                rows={3}
                placeholder="AI搭載のクロスチャネルマーケティング自動化プラットフォーム。6つの広告プラットフォームを一元管理。"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="mp-usp" className="mb-1 block text-sm font-medium text-foreground">
                  USP (強み)
                </label>
                <input
                  id="mp-usp"
                  type="text"
                  value={product.usp}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateProduct('usp', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="6チャネル統合管理、AI予算最適化"
                />
              </div>
              <div>
                <label htmlFor="mp-audience" className="mb-1 block text-sm font-medium text-foreground">
                  ターゲット層
                </label>
                <input
                  id="mp-audience"
                  type="text"
                  value={product.targetAudience}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateProduct('targetAudience', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="マーケティング担当者、広告代理店"
                />
              </div>
            </div>
            <div>
              <label htmlFor="mp-price" className="mb-1 block text-sm font-medium text-foreground">
                価格 (任意)
              </label>
              <input
                id="mp-price"
                type="text"
                value={product.price}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateProduct('price', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="月額 29,800円〜"
              />
            </div>

            {/* Language & Keigo */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <span className="mb-2 block text-sm font-medium text-foreground">言語</span>
                <div className="flex gap-2">
                  {([
                    { value: 'ja' as const, label: '日本語' },
                    { value: 'en' as const, label: 'English' },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateProduct('language', opt.value)}
                      className={cn(
                        'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                        product.language === opt.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/50',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="mb-2 block text-sm font-medium text-foreground">敬語レベル</span>
                <div className="flex gap-2">
                  {([
                    { value: 'casual' as const, label: 'カジュアル' },
                    { value: 'polite' as const, label: '丁寧' },
                    { value: 'formal' as const, label: 'フォーマル' },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateProduct('keigoLevel', opt.value)}
                      className={cn(
                        'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                        product.keigoLevel === opt.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/50',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Next button */}
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              disabled={!isStep1Valid}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              次へ: バリエーション設定
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Variation settings */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">バリエーション設定</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                組み合わせる要素を選択してください。選択数が多いほど多くのパターンが生成されます。
              </p>
            </div>

            <CheckboxGrid
              title="ヘッドライン切り口"
              items={HEADLINE_ANGLES}
              selected={selectedHeadlines}
              onToggle={(id) => toggleSet(setSelectedHeadlines, id)}
            />

            <CheckboxGrid
              title="本文アプローチ"
              items={BODY_APPROACHES}
              selected={selectedBodies}
              onToggle={(id) => toggleSet(setSelectedBodies, id)}
            />

            <CheckboxGrid
              title="CTA バリエーション"
              items={CTA_VARIATIONS}
              selected={selectedCtas}
              onToggle={(id) => toggleSet(setSelectedCtas, id)}
            />

            <CheckboxGrid
              title="画像スタイル"
              items={IMAGE_STYLES}
              selected={selectedStyles}
              onToggle={(id) => toggleSet(setSelectedStyles, id)}
            />

            <CheckboxGrid
              title="配信プラットフォーム"
              items={PLATFORMS}
              selected={selectedPlatforms}
              onToggle={(id) => toggleSet(setSelectedPlatforms, id)}
            />
          </div>

          {/* Combination calculator */}
          <CombinationCalculator
            headlineCount={Math.max(1, selectedHeadlines.size)}
            bodyCount={Math.max(1, selectedBodies.size)}
            ctaCount={Math.max(1, selectedCtas.size)}
            styleCount={Math.max(1, selectedStyles.size)}
            platformCount={Math.max(1, selectedPlatforms.size)}
            maxGeneration={maxGeneration}
            onMaxChange={setMaxGeneration}
          />

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <ArrowLeft size={14} />
              戻る
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              disabled={!isStep2Valid}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              次へ: 確認
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirmation & Launch */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">確認 & 生成開始</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              設定内容を確認して生成を開始してください
            </p>

            {/* Summary */}
            <div className="mt-5 space-y-4">
              {/* Product summary */}
              <div className="rounded-md bg-muted/50 p-4">
                <h4 className="text-sm font-semibold text-foreground">商品情報</h4>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">商品名:</span>{' '}
                    <span className="font-medium text-foreground">{product.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">言語:</span>{' '}
                    <span className="font-medium text-foreground">
                      {product.language === 'ja' ? '日本語' : 'English'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">説明:</span>{' '}
                    <span className="text-foreground">{product.description}</span>
                  </div>
                </div>
              </div>

              {/* Variation summary */}
              <div className="rounded-md bg-muted/50 p-4">
                <h4 className="text-sm font-semibold text-foreground">バリエーション設定</h4>
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">ヘッドライン切り口</span>
                    <span className="font-medium text-foreground">{selectedHeadlines.size} 選択</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">本文アプローチ</span>
                    <span className="font-medium text-foreground">{selectedBodies.size} 選択</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">CTA バリエーション</span>
                    <span className="font-medium text-foreground">{selectedCtas.size} 選択</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">画像スタイル</span>
                    <span className="font-medium text-foreground">{selectedStyles.size} 選択</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">プラットフォーム</span>
                    <span className="font-medium text-foreground">{selectedPlatforms.size} 選択</span>
                  </div>
                </div>
              </div>

              {/* Generation estimates */}
              <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2">
                  <Rocket size={16} className="text-primary" />
                  <h4 className="text-sm font-semibold text-foreground">生成見積もり</h4>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">生成数</p>
                    <p className="text-lg font-bold text-foreground">
                      {actualGeneration.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">推定時間</p>
                    <p className="text-lg font-bold text-foreground">
                      約 {estimatedMinutes} 分
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">推定コスト</p>
                    <p className="text-lg font-bold text-foreground">
                      {(actualGeneration * 0.5).toLocaleString()} クレジット
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <ArrowLeft size={14} />
              戻る
            </button>
            <button
              type="button"
              onClick={handleStartGeneration}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
            >
              <Sparkles size={18} />
              大量生成を開始
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
