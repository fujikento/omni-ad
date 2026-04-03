'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  FileVideo,
  Image,
  Loader2,
  Rocket,
  Sparkles,
  Star,
  Upload,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';

// -- Types --

type Platform = 'meta' | 'google' | 'x' | 'tiktok' | 'line_yahoo' | 'amazon' | 'microsoft';
type CreativeFormat = 'image' | 'video' | 'carousel' | 'text' | 'html5' | 'responsive';

interface Creative {
  id: string;
  headline: string;
  description: string;
  format: CreativeFormat;
  platforms: Platform[];
  thumbnail: string;
  score: number;
  impressions: number;
  clicks: number;
  ctr: number;
}

type WizardStep = 1 | 2 | 3 | 4;

// -- Constants --

const PLATFORM_LABELS: Record<Platform, string> = {
  meta: 'Meta',
  google: 'Google',
  x: 'X',
  tiktok: 'TikTok',
  line_yahoo: 'LINE/Yahoo',
  amazon: 'Amazon',
  microsoft: 'Microsoft',
};

const FORMAT_LABELS: Record<CreativeFormat, string> = {
  image: '画像',
  video: '動画',
  carousel: 'カルーセル',
  text: 'テキスト',
  html5: 'HTML5',
  responsive: 'レスポンシブ',
};

const MOCK_CREATIVES: Creative[] = [
  {
    id: '1', headline: '春の新作コレクション', description: '最新トレンドをチェック', format: 'image',
    platforms: ['google', 'meta'], thumbnail: '', score: 92, impressions: 45000, clicks: 2100, ctr: 4.7,
  },
  {
    id: '2', headline: '期間限定30%OFF', description: '今だけの特別価格', format: 'carousel',
    platforms: ['meta', 'tiktok'], thumbnail: '', score: 87, impressions: 38000, clicks: 1800, ctr: 4.3,
  },
  {
    id: '3', headline: '新生活応援キャンペーン', description: '新しい暮らしに必要なものを', format: 'video',
    platforms: ['tiktok', 'line_yahoo'], thumbnail: '', score: 78, impressions: 32000, clicks: 1200, ctr: 3.8,
  },
  {
    id: '4', headline: '会員限定セール', description: '会員だけの特別プライス', format: 'text',
    platforms: ['google', 'line_yahoo'], thumbnail: '', score: 71, impressions: 25000, clicks: 900, ctr: 3.6,
  },
  {
    id: '5', headline: '無料配送キャンペーン', description: '全品送料無料', format: 'image',
    platforms: ['meta', 'line_yahoo', 'x'], thumbnail: '', score: 85, impressions: 42000, clicks: 1950, ctr: 4.6,
  },
  {
    id: '6', headline: 'レビュー投稿でポイント付与', description: 'レビューを書いてポイントGET', format: 'responsive',
    platforms: ['google', 'meta', 'line_yahoo'], thumbnail: '', score: 65, impressions: 18000, clicks: 600, ctr: 3.3,
  },
];

// -- Batch Types & Mock --

type BatchStatus = 'processing' | 'completed' | 'failed';

interface CreativeBatch {
  id: string;
  name: string;
  status: BatchStatus;
  total: number;
  completed: number;
  createdAt: string;
}

const BATCH_STATUS_CONFIG: Record<BatchStatus, { label: string; className: string }> = {
  processing: {
    label: '生成中',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  completed: {
    label: '完了',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  failed: {
    label: 'エラー',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
};

const MOCK_BATCHES: CreativeBatch[] = [
  { id: 'b1', name: '春プロモーション大量生成', status: 'completed', total: 200, completed: 200, createdAt: '2026-04-01' },
  { id: 'b2', name: 'GWキャンペーン素材', status: 'processing', total: 350, completed: 128, createdAt: '2026-04-02' },
  { id: 'b3', name: 'TikTok向けクリエイティブ', status: 'completed', total: 150, completed: 150, createdAt: '2026-03-28' },
];

function BatchRow({ batch }: { batch: CreativeBatch }): React.ReactElement {
  const pct = batch.total > 0 ? Math.round((batch.completed / batch.total) * 100) : 0;
  const statusConfig = BATCH_STATUS_CONFIG[batch.status];

  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3 transition-colors hover:border-primary/20">
      <div className="flex items-center gap-3">
        <Rocket size={16} className="text-primary" />
        <div>
          <p className="text-sm font-medium text-foreground">{batch.name}</p>
          <p className="text-xs text-muted-foreground">{batch.createdAt}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                batch.status === 'completed' ? 'bg-green-500' : 'bg-primary',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {batch.completed}/{batch.total}
          </span>
        </div>
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', statusConfig.className)}>
          {statusConfig.label}
        </span>
        <Link
          href="/creatives/mass-production"
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="詳細を見る"
        >
          <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  );
}

const WIZARD_STEPS: { step: WizardStep; label: string }[] = [
  { step: 1, label: '商品情報入力' },
  { step: 2, label: 'プラットフォーム選択' },
  { step: 3, label: '生成設定' },
  { step: 4, label: '生成結果プレビュー' },
];

// -- Subcomponents --

function ScoreBadge({ score }: { score: number }): React.ReactElement {
  const color = score >= 80 ? 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
    : score >= 60 ? 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400'
    : 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', color)}>
      <Star size={10} />
      {score}
    </span>
  );
}

function CreativeCard({
  creative,
  onSelect,
}: {
  creative: Creative;
  onSelect: (id: string) => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={() => onSelect(creative.id)}
      className="group w-full rounded-lg border border-border bg-card text-left transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {/* Thumbnail area */}
      <div className="flex h-40 items-center justify-center rounded-t-lg bg-muted/50">
        <Image size={40} className="text-muted-foreground/30" />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground line-clamp-1">
            {creative.headline}
          </h3>
          <ScoreBadge score={creative.score} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
          {creative.description}
        </p>
        <div className="mt-3 flex flex-wrap gap-1">
          {creative.platforms.map((p) => (
            <span key={p} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {PLATFORM_LABELS[p]}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{FORMAT_LABELS[creative.format]}</span>
          <span>CTR {creative.ctr}%</span>
        </div>
      </div>
    </button>
  );
}

interface CreativeDetailProps {
  creative: Creative;
  onClose: () => void;
}

function CreativeDetail({ creative, onClose }: CreativeDetailProps): React.ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">{creative.headline}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="閉じる">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {/* Preview */}
          <div className="flex h-48 items-center justify-center rounded-lg bg-muted/50">
            <Image size={64} className="text-muted-foreground/30" />
          </div>

          {/* Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">見出し</p>
              <p className="text-sm font-medium text-foreground">{creative.headline}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">説明</p>
              <p className="text-sm text-foreground">{creative.description}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">フォーマット</p>
              <p className="text-sm text-foreground">{FORMAT_LABELS[creative.format]}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">スコア</p>
              <ScoreBadge score={creative.score} />
            </div>
          </div>

          {/* Platform variants */}
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">プラットフォーム別バリアント</p>
            <div className="space-y-2">
              {creative.platforms.map((p) => (
                <div key={p} className="flex items-center justify-between rounded-md border border-border px-4 py-3">
                  <span className="text-sm font-medium text-foreground">{PLATFORM_LABELS[p]}</span>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{creative.impressions.toLocaleString()} imp</span>
                    <span>{creative.clicks.toLocaleString()} clicks</span>
                    <span>CTR {creative.ctr}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface GenerateWizardProps {
  open: boolean;
  onClose: () => void;
}

function GenerateWizard({ open, onClose }: GenerateWizardProps): React.ReactElement | null {
  const [step, setStep] = useState<WizardStep>(1);
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [usp, setUsp] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [variantCount, setVariantCount] = useState(3);
  const [language, setLanguage] = useState('ja');
  const [keigoLevel, setKeigoLevel] = useState<'casual' | 'polite' | 'formal'>('polite');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  function togglePlatform(platform: Platform): void {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );
  }

  function handleGenerate(): void {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setGenerated(true);
    }, 3000);
  }

  function handleClose(): void {
    setStep(1);
    setGenerated(false);
    setIsGenerating(false);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-lg border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            <h2 className="text-lg font-semibold text-foreground">AI クリエイティブ生成</h2>
          </div>
          <button type="button" onClick={handleClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="閉じる">
            <X size={20} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex border-b border-border px-6">
          {WIZARD_STEPS.map((s) => (
            <div
              key={s.step}
              className={cn(
                'flex-1 border-b-2 py-3 text-center text-xs font-medium transition-colors',
                step === s.step
                  ? 'border-primary text-primary'
                  : step > s.step
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-muted-foreground',
              )}
            >
              {s.label}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="gen-product-name" className="mb-1 block text-sm font-medium text-foreground">商品名</label>
                <input
                  id="gen-product-name"
                  type="text"
                  value={productName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProductName(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="OMNI-AD マーケティングプラットフォーム"
                />
              </div>
              <div>
                <label htmlFor="gen-description" className="mb-1 block text-sm font-medium text-foreground">商品説明</label>
                <textarea
                  id="gen-description"
                  value={productDescription}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setProductDescription(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  rows={3}
                  placeholder="AI搭載のクロスチャネルマーケティング自動化プラットフォーム"
                />
              </div>
              <div>
                <label htmlFor="gen-usp" className="mb-1 block text-sm font-medium text-foreground">USP (差別化ポイント)</label>
                <input
                  id="gen-usp"
                  type="text"
                  value={usp}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsp(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="6チャネル統合管理、AI予算最適化"
                />
              </div>
              <div>
                <label htmlFor="gen-audience" className="mb-1 block text-sm font-medium text-foreground">ターゲットオーディエンス</label>
                <input
                  id="gen-audience"
                  type="text"
                  value={targetAudience}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetAudience(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="マーケティング担当者、広告代理店"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">クリエイティブを配信するプラットフォームを選択してください</p>
              <div className="grid grid-cols-2 gap-3">
                {(Object.entries(PLATFORM_LABELS) as [Platform, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => togglePlatform(key)}
                    className={cn(
                      'rounded-lg border p-4 text-left transition-colors',
                      selectedPlatforms.includes(key)
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-primary/50',
                    )}
                  >
                    <span className="text-sm font-medium text-foreground">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="gen-variants" className="mb-1 block text-sm font-medium text-foreground">
                  バリエーション数
                </label>
                <div className="relative">
                  <select
                    id="gen-variants"
                    value={variantCount}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVariantCount(Number(e.target.value))}
                    className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {[1, 2, 3, 5, 10].map((n) => (
                      <option key={n} value={n}>{n}個</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <div>
                <label htmlFor="gen-language" className="mb-1 block text-sm font-medium text-foreground">言語</label>
                <div className="relative">
                  <select
                    id="gen-language"
                    value={language}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLanguage(e.target.value)}
                    className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="ja">日本語</option>
                    <option value="en">English</option>
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <div>
                <span className="mb-2 block text-sm font-medium text-foreground">敬語レベル</span>
                <div className="flex gap-2">
                  {([
                    { value: 'casual', label: 'カジュアル' },
                    { value: 'polite', label: '丁寧' },
                    { value: 'formal', label: 'フォーマル' },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setKeigoLevel(option.value)}
                      className={cn(
                        'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                        keigoLevel === option.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/50',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              {isGenerating ? (
                <div className="flex h-48 flex-col items-center justify-center gap-3">
                  <Loader2 size={32} className="animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">AIがクリエイティブを生成中...</p>
                </div>
              ) : generated ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-green-600">生成完了</p>
                  {Array.from({ length: variantCount }, (_, i) => (
                    <div key={i} className="rounded-lg border border-border p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">バリアント {i + 1}</span>
                        <ScoreBadge score={85 - i * 5} />
                      </div>
                      <p className="mt-2 text-sm font-semibold text-foreground">
                        {productName || '商品名'} - バリアント {i + 1}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {productDescription || '説明文'} | {selectedPlatforms.map((p) => PLATFORM_LABELS[p]).join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-48 flex-col items-center justify-center gap-3">
                  <BrainCircuit size={40} className="text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">「生成」ボタンを押してクリエイティブを生成</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={() => step > 1 && setStep((step - 1) as WizardStep)}
            disabled={step === 1}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-30"
          >
            <ArrowLeft size={14} />
            戻る
          </button>
          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((step + 1) as WizardStep)}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              次へ
              <ArrowRight size={14} />
            </button>
          ) : !generated ? (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              生成
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              完了
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// -- File Upload Section --

const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime'];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  previewUrl: string | null;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
  errorMessage?: string;
}

function FileUploadSection({
  onUploadComplete,
}: {
  onUploadComplete: () => void;
}): React.ReactElement {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      return `${file.name}: 対応していないファイル形式です（jpg, png, gif, mp4, mov のみ）`;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `${file.name}: ファイルサイズが${MAX_FILE_SIZE_MB}MBを超えています`;
    }
    return null;
  }, []);

  const processFile = useCallback((file: File) => {
    const error = validateFile(file);
    const isImage = file.type.startsWith('image/');
    const previewUrl = isImage ? URL.createObjectURL(file) : null;

    const uploadedFile: UploadedFile = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      type: file.type,
      size: file.size,
      previewUrl,
      progress: error ? 0 : 0,
      status: error ? 'error' : 'uploading',
      errorMessage: error ?? undefined,
    };

    setFiles((prev) => [...prev, uploadedFile]);

    if (!error) {
      // Simulate upload progress (mock -- replace with real API)
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 30 + 10;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadedFile.id
                ? { ...f, progress: 100, status: 'complete' as const }
                : f,
            ),
          );
          onUploadComplete();
        } else {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadedFile.id ? { ...f, progress: Math.min(progress, 99) } : f,
            ),
          );
        }
      }, 300);
    }
  }, [validateFile, onUploadComplete]);

  function handleDragOver(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    droppedFiles.forEach(processFile);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>): void {
    const selectedFiles = Array.from(e.target.files ?? []);
    selectedFiles.forEach(processFile);
    // Reset input so same file can be selected again
    e.target.value = '';
  }

  function removeFile(id: string): void {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">ファイルアップロード</h2>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors',
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-border bg-card hover:border-primary/30',
        )}
      >
        <Upload size={32} className="text-muted-foreground/50" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            ファイルをドラッグ&ドロップ
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            または
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Upload size={14} />
          ファイルを選択
        </button>
        <p className="text-xs text-muted-foreground">
          jpg, png, gif, mp4, mov -- 最大{MAX_FILE_SIZE_MB}MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.gif,.mp4,.mov"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          aria-label="ファイルを選択"
        />
      </div>

      {/* Upload progress list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              {/* Preview */}
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-muted/50 overflow-hidden">
                {file.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={file.previewUrl}
                    alt={file.name}
                    className="h-full w-full object-cover"
                  />
                ) : file.type.startsWith('video/') ? (
                  <FileVideo size={20} className="text-muted-foreground/50" />
                ) : (
                  <Image size={20} className="text-muted-foreground/50" />
                )}
              </div>

              {/* Info + progress */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                {file.status === 'uploading' && (
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                )}
                {file.status === 'error' && file.errorMessage && (
                  <p className="mt-1 text-xs text-destructive">{file.errorMessage}</p>
                )}
                {file.status === 'complete' && (
                  <p className="mt-1 text-xs font-medium text-green-600">アップロード完了</p>
                )}
              </div>

              {/* Remove */}
              <button
                type="button"
                onClick={() => removeFile(file.id)}
                className="flex-shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label={`${file.name}を削除`}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -- Main Page --

export default function CreativesPage(): React.ReactElement {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadRefreshKey, setUploadRefreshKey] = useState(0);

  const creativesQuery = trpc.creatives.list.useQuery(undefined, { retry: false });

  // Use mock data when API is not available
  const creatives = creativesQuery.error ? MOCK_CREATIVES : (creativesQuery.data as Creative[] | undefined) ?? MOCK_CREATIVES;
  const isLoading = creativesQuery.isLoading && !creativesQuery.error;

  const selectedCreative = creatives.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            AIクリエイティブスタジオ
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AIを活用した広告クリエイティブの自動生成と最適化
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/creatives/mass-production"
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <Rocket size={16} />
            大量生産
          </Link>
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <Sparkles size={16} />
            AI生成
          </button>
        </div>
      </div>

      {/* File Upload */}
      <FileUploadSection
        key={uploadRefreshKey}
        onUploadComplete={() => {
          setUploadRefreshKey((prev) => prev + 1);
          creativesQuery.refetch().catch(() => {
            // Refetch silently fails when API is unavailable
          });
        }}
      />

      {/* Batch list */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">バッチ一覧</h2>
          <Link
            href="/creatives/mass-production"
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            すべて表示
          </Link>
        </div>
        <div className="mt-3 space-y-2">
          {MOCK_BATCHES.map((batch) => (
            <BatchRow key={batch.id} batch={batch} />
          ))}
        </div>
      </section>

      {/* Gallery grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-border bg-card">
              <div className="h-40 rounded-t-lg bg-muted" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : creatives.length === 0 ? (
        <div className="flex h-96 items-center justify-center rounded-lg border border-dashed border-border bg-card">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <BrainCircuit size={48} className="text-muted-foreground/30" />
            <p className="text-lg font-medium">クリエイティブがまだありません</p>
            <p className="text-sm">「AI生成」ボタンから最初のクリエイティブを作成しましょう</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {creatives.map((creative) => (
            <CreativeCard key={creative.id} creative={creative} onSelect={setSelectedId} />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selectedCreative && (
        <CreativeDetail creative={selectedCreative} onClose={() => setSelectedId(null)} />
      )}

      {/* Generate wizard */}
      <GenerateWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
