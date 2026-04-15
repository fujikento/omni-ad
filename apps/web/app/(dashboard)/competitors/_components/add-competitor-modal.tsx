'use client';

import { memo, useCallback, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { showToast } from '@/lib/show-toast';
import { useI18n } from '@/lib/i18n';
import {
  PLATFORM_CONFIG,
  STRATEGY_RADIO_OPTIONS,
} from '../_constants';
import type { CompetitorStrategy, Platform } from '../_types';

const ALL_PLATFORMS: Platform[] = [
  'google',
  'meta',
  'tiktok',
  'line_yahoo',
  'amazon',
];

interface AddCompetitorModalProps {
  open: boolean;
  onClose: () => void;
}

function AddCompetitorModalInner({
  open,
  onClose,
}: AddCompetitorModalProps): React.ReactElement | null {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [keywords, setKeywords] = useState('');
  const [strategy, setStrategy] =
    useState<CompetitorStrategy>('defensive');
  const [maxBidIncrease, setMaxBidIncrease] = useState(15);
  const [maxBudgetShift, setMaxBudgetShift] = useState(20);
  const [isAdding, setIsAdding] = useState(false);

  const handleTogglePlatform = useCallback((platform: Platform): void => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform],
    );
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>): void => {
      e.preventDefault();
      if (!name || !domain) return;
      setIsAdding(true);
      setTimeout(() => {
        setIsAdding(false);
        showToast(t('competitors.addedToast', { name }));
        onClose();
      }, 1500);
    },
    [name, domain, t, onClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {t('competitors.modalTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label={t('competitors.h5dce86')}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Brand name */}
          <div>
            <label
              htmlFor="comp-name"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              {t('competitors.brandName')}
            </label>
            <input
              id="comp-name"
              type="text"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setName(e.target.value)
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="CompetitorX"
              required
            />
          </div>

          {/* Domain */}
          <div>
            <label
              htmlFor="comp-domain"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              {t('competitors.domain')}
            </label>
            <input
              id="comp-domain"
              type="text"
              value={domain}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDomain(e.target.value)
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="competitor-x.co.jp"
              required
            />
          </div>

          {/* Platforms */}
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">
              {t('competitors.monitorPlatforms')}
            </p>
            <div className="flex flex-wrap gap-2">
              {ALL_PLATFORMS.map((p) => {
                const checked = selectedPlatforms.includes(p);
                return (
                  <label
                    key={p}
                    className={cn(
                      'inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                      checked
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted/50',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => handleTogglePlatform(p)}
                    />
                    {PLATFORM_CONFIG[p].label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Keywords */}
          <div>
            <label
              htmlFor="comp-keywords"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              {t('competitors.keywords')}
            </label>
            <input
              id="comp-keywords"
              type="text"
              value={keywords}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setKeywords(e.target.value)
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={t('competitors.keywordsPlaceholder')}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t('competitors.keywordsHint')}
            </p>
          </div>

          {/* Strategy */}
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">
              {t('competitors.counterStrategy')}
            </p>
            <div className="space-y-2">
              {STRATEGY_RADIO_OPTIONS.map((opt) => {
                const selected = strategy === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStrategy(opt.value)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg border-2 p-3 text-left transition-all',
                      selected
                        ? `${opt.borderColor} ${opt.bgColor}`
                        : 'border-border hover:border-border/80 hover:bg-muted/30',
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2',
                        selected
                          ? 'border-transparent bg-primary'
                          : 'border-muted-foreground/40',
                      )}
                    />
                    <div>
                      <p
                        className={cn(
                          'text-sm font-semibold',
                          selected ? opt.textColor : 'text-foreground',
                        )}
                      >
                        {t(opt.labelKey)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t(opt.descriptionKey)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Guardrails */}
          <div className="space-y-4 rounded-lg border border-border p-4">
            <h3 className="text-sm font-medium text-foreground">
              {t('competitors.guardrails')}
            </h3>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('competitors.maxBidIncrease')}</span>
                <span className="font-medium text-foreground">
                  {maxBidIncrease}%
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={30}
                step={1}
                value={maxBidIncrease}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setMaxBidIncrease(Number(e.target.value))
                }
                className="w-full accent-primary"
                aria-label={t('competitors.h1fe820')}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>5%</span>
                <span>30%</span>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('competitors.maxBudgetShift')}</span>
                <span className="font-medium text-foreground">
                  {maxBudgetShift}%
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={50}
                step={1}
                value={maxBudgetShift}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setMaxBudgetShift(Number(e.target.value))
                }
                className="w-full accent-primary"
                aria-label={t('competitors.h8accf1')}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>5%</span>
                <span>50%</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              {t('competitors.h6ef349')}
            </button>
            <button
              type="submit"
              disabled={isAdding || !name || !domain}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isAdding ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              {t('competitors.addBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export const AddCompetitorModal = memo(AddCompetitorModalInner);
