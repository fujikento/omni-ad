'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Download,
  Edit3,
  Film,
  Loader2,
  Monitor,
  Music,
  Play,
  RefreshCw,
  Smartphone,
  Sparkles,
  Type,
  Volume2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

// ============================================================
// Types
// ============================================================

type StepNumber = 1 | 2 | 3 | 4;
type VideoDuration = 6 | 15 | 30;
type VideoTone = 'professional' | 'casual' | 'energetic' | 'emotional';
type Language = 'ja' | 'en';
type KeigoLevel = 'casual' | 'polite' | 'formal';

interface PlatformOption {
  id: string;
  labelKey: string;
  aspect: string;
  width: number;
  height: number;
}

interface SceneData {
  id: string;
  order: number;
  duration: number;
  description: string;
  textOverlay: string;
  transition: string;
  visualStyle: string;
}

interface VideoScript {
  scenes: SceneData[];
  voiceover: string;
  musicMood: string;
  ctaTiming: number;
  totalDuration: number;
}

interface BriefData {
  productName: string;
  productDescription: string;
  target: string;
  goal: string;
  duration: VideoDuration;
  platform: string;
  tone: VideoTone;
  language: Language;
  keigoLevel: KeigoLevel;
}

interface SceneGenerationProgress {
  sceneIndex: number;
  total: number;
  status: 'generating' | 'completed' | 'idle';
}

// ============================================================
// Constants
// ============================================================

const STEPS: { step: StepNumber; labelKey: string }[] = [
  { step: 1, labelKey: 'videoStudio.step1' },
  { step: 2, labelKey: 'videoStudio.step2' },
  { step: 3, labelKey: 'videoStudio.step3' },
  { step: 4, labelKey: 'videoStudio.step4' },
];

const DURATIONS: { value: VideoDuration; label: string }[] = [
  { value: 6, label: '6s' },
  { value: 15, label: '15s' },
  { value: 30, label: '30s' },
];

const PLATFORMS: PlatformOption[] = [
  { id: 'tiktok', labelKey: 'videoStudio.platformTikTok', aspect: '9:16', width: 9, height: 16 },
  { id: 'meta', labelKey: 'videoStudio.platformMeta', aspect: '1:1', width: 1, height: 1 },
  { id: 'youtube', labelKey: 'videoStudio.platformYouTube', aspect: '16:9', width: 16, height: 9 },
];

const TONES: { id: VideoTone; labelKey: string }[] = [
  { id: 'professional', labelKey: 'videoStudio.toneProfessional' },
  { id: 'casual', labelKey: 'videoStudio.toneCasual' },
  { id: 'energetic', labelKey: 'videoStudio.toneEnergetic' },
  { id: 'emotional', labelKey: 'videoStudio.toneEmotional' },
];

const TRANSITION_ICONS: Record<string, string> = {
  cut: 'Cut',
  fade: 'Fade',
  slide: 'Slide',
  zoom: 'Zoom',
};

function getMockScript(t: (key: string, params?: Record<string, string | number>) => string): VideoScript {
  return {
  scenes: [
    {
      id: 's1',
      order: 1,
      duration: 3,
      description: t('creatives.videostudio.h107067'),
      textOverlay: t('creatives.videostudio.h4bcced'),
      transition: 'fade',
      visualStyle: 'cinematic',
    },
    {
      id: 's2',
      order: 2,
      duration: 4,
      description: t('creatives.videostudio.ha8e970'),
      textOverlay: t('creatives.videostudio.h0c1ff8'),
      transition: 'slide',
      visualStyle: 'lifestyle',
    },
    {
      id: 's3',
      order: 3,
      duration: 4,
      description: t('creatives.videostudio.h54759f'),
      textOverlay: t('creatives.videostudio.h71fadb'),
      transition: 'zoom',
      visualStyle: 'comparison',
    },
    {
      id: 's4',
      order: 4,
      duration: 4,
      description: t('creatives.videostudio.h475190'),
      textOverlay: t('creatives.videostudio.h294692'),
      transition: 'cut',
      visualStyle: 'brand',
    },
  ],
  voiceover: t('creatives.videostudio.h9b3706'),
  musicMood: 'uplifting',
  ctaTiming: 12,
  totalDuration: 15,
};
}

// ============================================================
// Subcomponents
// ============================================================

function StepIndicator({
  currentStep,
}: {
  currentStep: StepNumber;
}): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => (
        <div key={s.step} className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
              s.step === currentStep
                ? 'bg-primary text-primary-foreground'
                : s.step < currentStep
                  ? 'bg-green-500 text-white'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            {s.step < currentStep ? <Check size={14} /> : s.step}
          </div>
          <span
            className={cn(
              'hidden text-sm font-medium sm:inline',
              s.step === currentStep ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {t(s.labelKey)}
          </span>
          {i < STEPS.length - 1 && (
            <ChevronRight size={14} className="text-muted-foreground" />
          )}
        </div>
      ))}
    </div>
  );
}

function AspectRatioPreview({
  width,
  height,
  label,
  selected,
}: {
  width: number;
  height: number;
  label: string;
  selected: boolean;
}): React.ReactElement {
  const maxSize = 48;
  const ratio = width / height;
  const w = ratio >= 1 ? maxSize : Math.round(maxSize * ratio);
  const h = ratio >= 1 ? Math.round(maxSize / ratio) : maxSize;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={cn(
          'rounded border-2 transition-colors',
          selected ? 'border-primary bg-primary/10' : 'border-border bg-muted/50',
        )}
        style={{ width: `${w}px`, height: `${h}px` }}
      />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function SceneCard({
  scene,
  totalDuration,
  onEdit,
}: {
  scene: SceneData;
  totalDuration: number;
  onEdit: (sceneId: string) => void;
}): React.ReactElement {
  const { t } = useI18n();
  const pct = totalDuration > 0 ? (scene.duration / totalDuration) * 100 : 0;

  return (
    <div className="flex-shrink-0 w-56 rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/40">
      {/* Duration bar */}
      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-foreground">
          {t('videoStudio.sceneLabel')} {scene.order}
        </span>
        <span className="text-[10px] text-muted-foreground">{scene.duration}s</span>
      </div>

      {/* Visual placeholder */}
      <div className="mb-2 flex h-24 items-center justify-center rounded bg-muted/50">
        <Film size={24} className="text-muted-foreground/40" />
      </div>

      <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">
        {scene.description}
      </p>

      {/* Text overlay */}
      <div className="flex items-center gap-1 mb-1.5">
        <Type size={10} className="text-primary" />
        <span className="text-xs font-medium text-foreground line-clamp-1">
          {scene.textOverlay}
        </span>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5">
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {TRANSITION_ICONS[scene.transition] ?? scene.transition}
        </span>
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
          {scene.visualStyle}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onEdit(scene.id)}
        className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-border py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={t('common.edit')}
      >
        <Edit3 size={10} />
        {t('common.edit')}
      </button>
    </div>
  );
}

function SceneEditModal({
  scene,
  onSave,
  onClose,
}: {
  scene: SceneData;
  onSave: (updated: SceneData) => void;
  onClose: () => void;
}): React.ReactElement {
  const { t } = useI18n();
  const [description, setDescription] = useState(scene.description);
  const [textOverlay, setTextOverlay] = useState(scene.textOverlay);

  function handleSave(): void {
    onSave({ ...scene, description, textOverlay });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t('videoStudio.editScene')} {scene.order}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              {t('videoStudio.sceneDescription')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              rows={3}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              {t('videoStudio.textOverlay')}
            </label>
            <input
              type="text"
              value={textOverlay}
              onChange={(e) => setTextOverlay(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Step Components
// ============================================================

function BriefStep({
  brief,
  onChange,
  onNext,
}: {
  brief: BriefData;
  onChange: (updated: BriefData) => void;
  onNext: () => void;
}): React.ReactElement {
  const { t } = useI18n();

  function updateField<K extends keyof BriefData>(key: K, value: BriefData[K]): void {
    onChange({ ...brief, [key]: value });
  }

  const canProceed =
    brief.productName.trim() !== '' &&
    brief.productDescription.trim() !== '' &&
    brief.target.trim() !== '' &&
    brief.goal.trim() !== '';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{t('videoStudio.briefTitle')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('videoStudio.briefDescription')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            {t('videoStudio.productName')}
          </label>
          <input
            type="text"
            value={brief.productName}
            onChange={(e) => updateField('productName', e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            placeholder={t('videoStudio.productNamePlaceholder')}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            {t('videoStudio.target')}
          </label>
          <input
            type="text"
            value={brief.target}
            onChange={(e) => updateField('target', e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            placeholder={t('videoStudio.targetPlaceholder')}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-foreground">
          {t('videoStudio.productDescription')}
        </label>
        <textarea
          value={brief.productDescription}
          onChange={(e) => updateField('productDescription', e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          rows={3}
          placeholder={t('videoStudio.productDescPlaceholder')}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-foreground">
          {t('videoStudio.campaignGoal')}
        </label>
        <input
          type="text"
          value={brief.goal}
          onChange={(e) => updateField('goal', e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          placeholder={t('videoStudio.goalPlaceholder')}
        />
      </div>

      {/* Duration */}
      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">
          {t('videoStudio.videoDuration')}
        </label>
        <div className="flex gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => updateField('duration', d.value)}
              className={cn(
                'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                brief.duration === d.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-foreground hover:border-primary/40',
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Platform */}
      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">
          {t('videoStudio.platformLabel')}
        </label>
        <div className="flex gap-3">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => updateField('platform', p.id)}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
                brief.platform === p.id
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-primary/40',
              )}
            >
              <AspectRatioPreview
                width={p.width}
                height={p.height}
                label={p.aspect}
                selected={brief.platform === p.id}
              />
              <span className="text-sm font-medium text-foreground">{t(p.labelKey)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tone */}
      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">
          {t('videoStudio.tone')}
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TONES.map((tone) => (
            <button
              key={tone.id}
              type="button"
              onClick={() => updateField('tone', tone.id)}
              className={cn(
                'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                brief.tone === tone.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-foreground hover:border-primary/40',
              )}
            >
              {t(tone.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Language + Keigo */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            {t('videoStudio.language')}
          </label>
          <select
            value={brief.language}
            onChange={(e) => updateField('language', e.target.value as Language)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option value="ja">{t('videoStudio.langJa')}</option>
            <option value="en">{t('videoStudio.langEn')}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            {t('videoStudio.keigoLevel')}
          </label>
          <select
            value={brief.keigoLevel}
            onChange={(e) => updateField('keigoLevel', e.target.value as KeigoLevel)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option value="casual">{t('videoStudio.keigoCasual')}</option>
            <option value="polite">{t('videoStudio.keigoPolite')}</option>
            <option value="formal">{t('videoStudio.keigoFormal')}</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {t('videoStudio.generateScript')}
          <Sparkles size={16} />
        </button>
      </div>
    </div>
  );
}

function ScriptPreviewStep({
  script,
  onRegenerate,
  onEditScene,
  onNext,
  onBack,
}: {
  script: VideoScript;
  onRegenerate: () => void;
  onEditScene: (sceneId: string) => void;
  onNext: () => void;
  onBack: () => void;
}): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{t('videoStudio.scriptPreviewTitle')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('videoStudio.scriptPreviewDesc')}</p>
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <RefreshCw size={14} />
          {t('videoStudio.regenerate')}
        </button>
      </div>

      {/* Timeline */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-foreground">{t('videoStudio.timeline')}</h4>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {script.scenes.map((scene) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              totalDuration={script.totalDuration}
              onEdit={onEditScene}
            />
          ))}
        </div>
      </div>

      {/* Voiceover */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Volume2 size={16} className="text-primary" />
          <h4 className="text-sm font-semibold text-foreground">{t('videoStudio.voiceover')}</h4>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{script.voiceover}</p>
      </div>

      {/* Music & CTA */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Music size={16} className="text-primary" />
            <h4 className="text-sm font-semibold text-foreground">{t('videoStudio.musicMood')}</h4>
          </div>
          <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {script.musicMood}
          </span>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} className="text-primary" />
            <h4 className="text-sm font-semibold text-foreground">{t('videoStudio.ctaTiming')}</h4>
          </div>
          <span className="text-sm text-foreground">{script.ctaTiming}s / {script.totalDuration}s</span>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <ArrowLeft size={14} />
          {t('common.back')}
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t('videoStudio.generateAssets')}
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function AssetGenerationStep({
  progress,
  scenes,
  onAssemble,
  onBack,
}: {
  progress: SceneGenerationProgress;
  scenes: SceneData[];
  onAssemble: () => void;
  onBack: () => void;
}): React.ReactElement {
  const { t } = useI18n();
  const allCompleted = progress.status === 'completed';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{t('videoStudio.assetGenTitle')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('videoStudio.assetGenDesc')}</p>
      </div>

      {/* Progress */}
      {progress.status === 'generating' && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 size={16} className="animate-spin text-primary" />
            <span className="text-sm font-medium text-foreground">
              {t('videoStudio.generatingScene').replace('{current}', String(progress.sceneIndex + 1)).replace('{total}', String(progress.total))}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${((progress.sceneIndex + 1) / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Scene previews */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {scenes.map((scene, i) => {
          const isGenerated = progress.status === 'completed' || i < progress.sceneIndex;
          const isGenerating = progress.status === 'generating' && i === progress.sceneIndex;

          return (
            <div
              key={scene.id}
              className={cn(
                'rounded-lg border p-3 transition-all',
                isGenerated ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' :
                isGenerating ? 'border-primary bg-primary/5' : 'border-border bg-card',
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">
                  {t('videoStudio.sceneLabel')} {scene.order}
                </span>
                {isGenerated && <Check size={14} className="text-green-500" />}
                {isGenerating && <Loader2 size={14} className="animate-spin text-primary" />}
              </div>
              <div className="flex h-24 items-center justify-center rounded bg-muted/50">
                {isGenerated ? (
                  <Film size={24} className="text-green-400" />
                ) : (
                  <Film size={24} className="text-muted-foreground/30" />
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground line-clamp-1">{scene.textOverlay}</p>
            </div>
          );
        })}
      </div>

      {/* Audio player placeholder */}
      {allCompleted && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"
              aria-label={t('videoStudio.playVoiceover')}
            >
              <Play size={16} />
            </button>
            <div className="flex-1">
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div className="h-full w-0 rounded-full bg-primary" />
              </div>
            </div>
            <span className="text-xs text-muted-foreground">0:00 / 0:15</span>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <ArrowLeft size={14} />
          {t('common.back')}
        </button>
        <button
          type="button"
          onClick={onAssemble}
          disabled={!allCompleted}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {t('videoStudio.assembleVideo')}
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function PreviewExportStep({
  script,
  platformId,
  onApprove,
  onBack,
}: {
  script: VideoScript;
  platformId: string;
  onApprove: () => void;
  onBack: () => void;
}): React.ReactElement {
  const { t } = useI18n();
  const defaultPlatform: PlatformOption = { id: 'tiktok', labelKey: 'videoStudio.platformTikTok', aspect: '9:16', width: 9, height: 16 };
  const platform = PLATFORMS.find((p) => p.id === platformId) ?? defaultPlatform;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{t('videoStudio.previewTitle')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('videoStudio.previewDesc')}</p>
      </div>

      {/* Video player placeholder */}
      <div className="mx-auto flex items-center justify-center rounded-lg border border-border bg-black/90">
        <div
          className="relative flex items-center justify-center"
          style={{
            width: platform.width >= platform.height ? '100%' : 'auto',
            maxWidth: '500px',
            aspectRatio: `${platform.width}/${platform.height}`,
          }}
        >
          <div className="flex flex-col items-center gap-2 text-white/60">
            <Play size={48} />
            <span className="text-sm">{t('videoStudio.storyboardPreview')}</span>
          </div>
          {/* Duration badge */}
          <div className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
            0:{String(script.totalDuration).padStart(2, '0')}
          </div>
        </div>
      </div>

      {/* Platform previews */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-foreground">{t('videoStudio.platformPreview')}</h4>
        <div className="flex gap-4">
          {PLATFORMS.map((p) => (
            <div
              key={p.id}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border p-3 transition-colors',
                p.id === platformId
                  ? 'border-primary bg-primary/5'
                  : 'border-border opacity-50',
              )}
            >
              {p.height > p.width ? (
                <Smartphone size={20} className="text-muted-foreground" />
              ) : (
                <Monitor size={20} className="text-muted-foreground" />
              )}
              <span className="text-[10px] font-medium text-foreground">{t(p.labelKey)}</span>
              <span className="text-[10px] text-muted-foreground">{p.aspect}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <ArrowLeft size={14} />
          {t('common.back')}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Download size={14} />
            {t('videoStudio.export')}
          </button>
          <button
            type="button"
            onClick={onApprove}
            className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
          >
            <Check size={14} />
            {t('videoStudio.approve')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function VideoStudioPage(): React.ReactElement {
  const { t } = useI18n();
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [brief, setBrief] = useState<BriefData>({
    productName: '',
    productDescription: '',
    target: '',
    goal: '',
    duration: 15,
    platform: 'tiktok',
    tone: 'professional',
    language: 'ja',
    keigoLevel: 'polite',
  });
  const [script, setScript] = useState<VideoScript>(getMockScript(t));
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [assetProgress, setAssetProgress] = useState<SceneGenerationProgress>({
    sceneIndex: 0,
    total: 4,
    status: 'idle',
  });
  const [approved, setApproved] = useState(false);

  function handleGenerateScript(): void {
    // Simulate script generation
    setScript(getMockScript(t));
    setCurrentStep(2);
  }

  function handleRegenerate(): void {
    // In production this would call the AI again
    setScript({ ...getMockScript(t) });
  }

  function handleEditScene(sceneId: string): void {
    setEditingSceneId(sceneId);
  }

  function handleSaveScene(updated: SceneData): void {
    setScript((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) => (s.id === updated.id ? updated : s)),
    }));
    setEditingSceneId(null);
  }

  function handleStartAssetGeneration(): void {
    setCurrentStep(3);
    setAssetProgress({ sceneIndex: 0, total: script.scenes.length, status: 'generating' });

    // Simulate sequential generation
    let idx = 0;
    const interval = setInterval(() => {
      idx += 1;
      if (idx >= script.scenes.length) {
        setAssetProgress({ sceneIndex: script.scenes.length - 1, total: script.scenes.length, status: 'completed' });
        clearInterval(interval);
      } else {
        setAssetProgress({ sceneIndex: idx, total: script.scenes.length, status: 'generating' });
      }
    }, 1200);
  }

  function handleAssemble(): void {
    setCurrentStep(4);
  }

  function handleApprove(): void {
    setApproved(true);
  }

  const editingScene = editingSceneId
    ? script.scenes.find((s) => s.id === editingSceneId) ?? null
    : null;

  if (approved) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <Check size={32} className="text-green-600 dark:text-green-400" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-foreground">{t('videoStudio.approvedTitle')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('videoStudio.approvedDesc')}</p>
        <Link
          href="/creatives"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t('videoStudio.backToCreatives')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Link
          href="/creatives"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={t('common.back')}
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t('videoStudio.title')}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t('videoStudio.description')}
          </p>
        </div>
      </div>

      {/* Steps */}
      <StepIndicator currentStep={currentStep} />

      {/* Step content */}
      {currentStep === 1 && (
        <BriefStep
          brief={brief}
          onChange={setBrief}
          onNext={handleGenerateScript}
        />
      )}

      {currentStep === 2 && (
        <ScriptPreviewStep
          script={script}
          onRegenerate={handleRegenerate}
          onEditScene={handleEditScene}
          onNext={handleStartAssetGeneration}
          onBack={() => setCurrentStep(1)}
        />
      )}

      {currentStep === 3 && (
        <AssetGenerationStep
          progress={assetProgress}
          scenes={script.scenes}
          onAssemble={handleAssemble}
          onBack={() => setCurrentStep(2)}
        />
      )}

      {currentStep === 4 && (
        <PreviewExportStep
          script={script}
          platformId={brief.platform}
          onApprove={handleApprove}
          onBack={() => setCurrentStep(3)}
        />
      )}

      {/* Scene edit modal */}
      {editingScene && (
        <SceneEditModal
          scene={editingScene}
          onSave={handleSaveScene}
          onClose={() => setEditingSceneId(null)}
        />
      )}
    </div>
  );
}
