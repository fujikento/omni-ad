'use client';

import { memo, useCallback, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { getDayLabels } from '../_constants';
import type { WeakWindowCell } from '../_types';

function getCellColor(cell: WeakWindowCell): string {
  const ratio = cell.competitorCpc / cell.avgCpc;
  if (ratio < 0.7) return 'bg-green-500/80';
  if (ratio < 0.85) return 'bg-green-400/60';
  if (ratio < 0.95) return 'bg-green-300/40';
  if (ratio < 1.05) return 'bg-yellow-300/40';
  if (ratio < 1.15) return 'bg-orange-400/60';
  return 'bg-red-500/80';
}

interface WeakWindowsHeatmapProps {
  data: WeakWindowCell[];
}

function WeakWindowsHeatmapInner({
  data,
}: WeakWindowsHeatmapProps): React.ReactElement {
  const { t } = useI18n();
  const [hoveredCell, setHoveredCell] = useState<WeakWindowCell | null>(null);

  const handleEnter = useCallback((cell: WeakWindowCell) => {
    setHoveredCell(cell);
  }, []);
  const handleLeave = useCallback(() => {
    setHoveredCell(null);
  }, []);

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-1 text-lg font-semibold text-foreground">
          {t('competitors.weakWindowMap')}
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          {t('competitors.weakWindowDesc')}
        </p>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Clock size={28} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
        </div>
      </div>
    );
  }

  const dayLabels = getDayLabels(t);

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-1 text-lg font-semibold text-foreground">
        {t('competitors.weakWindowMap')}
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        {t('competitors.weakWindowDesc')}
      </p>

      <div className="overflow-x-auto">
        <div
          className="min-w-[700px]"
          role="grid"
          aria-label={t('competitors.weakWindowLabel')}
        >
          {/* Hour labels */}
          <div className="mb-1 flex" role="row">
            <div className="w-10 flex-shrink-0" role="columnheader" />
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="flex-1 text-center text-[9px] text-muted-foreground"
                role="columnheader"
              >
                {h}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {Array.from({ length: 7 }, (_, dayIdx) => (
            <div
              key={dayIdx}
              className="flex items-center gap-0.5"
              role="row"
            >
              <div
                className="w-10 flex-shrink-0 pr-2 text-right text-xs font-medium text-muted-foreground"
                role="rowheader"
              >
                {dayLabels[dayIdx]}
              </div>
              {Array.from({ length: 24 }, (_, hourIdx) => {
                const cell = data.find(
                  (c) => c.day === dayIdx && c.hour === hourIdx,
                );
                if (!cell) return null;
                const isHovered =
                  hoveredCell?.day === dayIdx &&
                  hoveredCell?.hour === hourIdx;
                return (
                  <div
                    key={hourIdx}
                    className={cn(
                      'aspect-square flex-1 cursor-pointer rounded-sm transition-opacity',
                      getCellColor(cell),
                      isHovered ? 'ring-2 ring-foreground' : '',
                    )}
                    onMouseEnter={() => handleEnter(cell)}
                    onMouseLeave={handleLeave}
                    role="gridcell"
                    aria-label={t('competitors.heatmapCellAria', {
                      day: dayLabels[dayIdx] ?? '',
                      hour: String(hourIdx),
                      cpc: String(cell.competitorCpc),
                    })}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {hoveredCell !== null && (
        <div className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-foreground">
          {dayLabels[hoveredCell.day] ?? ''}
          {t('competitors.dayOfWeekSuffix')} {hoveredCell.hour}:00 - CPC ¥
          {hoveredCell.competitorCpc} ({t('competitors.vsAvg')}
          {Math.round(
            ((hoveredCell.competitorCpc - hoveredCell.avgCpc) /
              hoveredCell.avgCpc) *
              100,
          )}
          %), {t('competitors.impressionShareLabel')}{' '}
          {hoveredCell.impressionShare}%
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-sm bg-green-500/80" />
          <span className="text-[10px] text-muted-foreground">
            {t('competitors.legendWeak')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-sm bg-yellow-300/40" />
          <span className="text-[10px] text-muted-foreground">
            {t('competitors.legendEven')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-sm bg-red-500/80" />
          <span className="text-[10px] text-muted-foreground">
            {t('competitors.legendStrong')}
          </span>
        </div>
      </div>
    </div>
  );
}

export const WeakWindowsHeatmap = memo(WeakWindowsHeatmapInner);
