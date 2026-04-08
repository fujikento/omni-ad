'use client';

import { useI18n } from '@/lib/i18n';

import { useState } from 'react';
import {
  Check,
  Clipboard,
  Code2,
  ExternalLink,
  Globe,
  Plus,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

interface PlatformMapping {
  metaCapi: boolean;
  metaPixelId: string;
  metaAccessToken: string;
  googleEc: boolean;
  googleConversionId: string;
  googleLabel: string;
  tiktok: boolean;
  tiktokPixelId: string;
  lineYahoo: boolean;
  lineYahooTagId: string;
}

interface TrackingEndpoint {
  id: string;
  name: string;
  active: boolean;
  pixelId: string;
  domains: string[];
  eventTypes: EventType[];
  platformMapping: PlatformMapping;
  statsToday: number;
  statsWeek: number;
}

interface DailyConversion {
  date: string;
  purchase: number;
  lead: number;
  addToCart: number;
  signup: number;
}

interface PlatformSyncStatus {
  platform: string;
  sent: number;
  confirmed: number;
  rate: number;
}

interface RecentEvent {
  id: string;
  timestamp: string;
  eventType: EventType;
  value: number | null;
  sourceUrl: string;
  platformMatched: string[];
}

type EventType = 'purchase' | 'lead' | 'add_to_cart' | 'signup' | 'custom';
type ModalMode = 'closed' | 'create' | 'edit' | 'code';

interface FormState {
  name: string;
  domains: string[];
  domainInput: string;
  eventTypes: Set<EventType>;
  platformMapping: PlatformMapping;
}

// ============================================================
// Constants
// ============================================================

function getEventTypeLabels(t: (key: string, params?: Record<string, string | number>) => string): Record<EventType, string> {
  return {
  purchase: t('settings.conversions.h57997c'),
  lead: t('settings.conversions.h7079a7'),
  add_to_cart: t('settings.conversions.hfc18be'),
  signup: t('settings.conversions.hfc96d0'),
  custom: t('settings.conversions.h8032dc'),
};
}

const EVENT_TYPE_OPTIONS: EventType[] = ['purchase', 'lead', 'add_to_cart', 'signup', 'custom'];

const DEFAULT_PLATFORM_MAPPING: PlatformMapping = {
  metaCapi: false,
  metaPixelId: '',
  metaAccessToken: '',
  googleEc: false,
  googleConversionId: '',
  googleLabel: '',
  tiktok: false,
  tiktokPixelId: '',
  lineYahoo: false,
  lineYahooTagId: '',
};

// ============================================================
// Mock Data
// ============================================================

function getMockEndpoints(t: (key: string, params?: Record<string, string | number>) => string): TrackingEndpoint[] {
  return [
  {
    id: 'ep1',
    name: t('settings.conversions.h53dddd'),
    active: true,
    pixelId: 'PX-abc123def456',
    domains: ['example.com', 'shop.example.com'],
    eventTypes: ['purchase', 'lead', 'add_to_cart'],
    platformMapping: {
      metaCapi: true,
      metaPixelId: '123456789012345',
      metaAccessToken: 'EAAx...',
      googleEc: true,
      googleConversionId: 'AW-123456789',
      googleLabel: 'AbCdEf',
      tiktok: false,
      tiktokPixelId: '',
      lineYahoo: false,
      lineYahooTagId: '',
    },
    statsToday: 142,
    statsWeek: 1284,
  },
  {
    id: 'ep2',
    name: t('settings.conversions.h6e1849'),
    active: true,
    pixelId: 'PX-xyz789ghi012',
    domains: ['lp.example.com'],
    eventTypes: ['lead', 'signup'],
    platformMapping: {
      metaCapi: true,
      metaPixelId: '987654321098765',
      metaAccessToken: 'EAAy...',
      googleEc: true,
      googleConversionId: 'AW-987654321',
      googleLabel: 'GhIjKl',
      tiktok: true,
      tiktokPixelId: 'C9ABC123DEF',
      lineYahoo: true,
      lineYahooTagId: 'LY-112233',
    },
    statsToday: 58,
    statsWeek: 523,
  },
];
}

const MOCK_DAILY_CONVERSIONS: DailyConversion[] = Array.from({ length: 7 }, (_, i) => {
  const date = new Date(2026, 2, 27 + i);
  return {
    date: `${date.getMonth() + 1}/${date.getDate()}`,
    purchase: Math.round(30 + Math.random() * 20),
    lead: Math.round(40 + Math.random() * 25),
    addToCart: Math.round(60 + Math.random() * 30),
    signup: Math.round(15 + Math.random() * 10),
  };
});

const MOCK_SYNC_STATUS: PlatformSyncStatus[] = [
  { platform: 'Meta CAPI', sent: 1807, confirmed: 1745, rate: 96.6 },
  { platform: 'Google EC', sent: 1807, confirmed: 1790, rate: 99.1 },
  { platform: 'TikTok', sent: 523, confirmed: 498, rate: 95.2 },
  { platform: 'LINE/Yahoo', sent: 523, confirmed: 510, rate: 97.5 },
];

const MOCK_RECENT_EVENTS: RecentEvent[] = [
  { id: 'e1', timestamp: '2026/04/02 14:32:05', eventType: 'purchase', value: 29800, sourceUrl: 'shop.example.com/checkout', platformMatched: ['Meta', 'Google'] },
  { id: 'e2', timestamp: '2026/04/02 14:28:11', eventType: 'lead', value: null, sourceUrl: 'lp.example.com/form', platformMatched: ['Meta', 'Google', 'TikTok'] },
  { id: 'e3', timestamp: '2026/04/02 14:25:33', eventType: 'add_to_cart', value: 5980, sourceUrl: 'shop.example.com/product/123', platformMatched: ['Meta', 'Google'] },
  { id: 'e4', timestamp: '2026/04/02 14:20:48', eventType: 'signup', value: null, sourceUrl: 'lp.example.com/register', platformMatched: ['Meta', 'Google', 'LINE'] },
  { id: 'e5', timestamp: '2026/04/02 14:15:02', eventType: 'purchase', value: 15800, sourceUrl: 'shop.example.com/checkout', platformMatched: ['Meta', 'Google'] },
  { id: 'e6', timestamp: '2026/04/02 14:10:19', eventType: 'lead', value: null, sourceUrl: 'lp.example.com/form', platformMatched: ['Meta', 'TikTok'] },
  { id: 'e7', timestamp: '2026/04/02 14:05:44', eventType: 'add_to_cart', value: 12400, sourceUrl: 'shop.example.com/product/456', platformMatched: ['Meta', 'Google'] },
];

// ============================================================
// Helpers
// ============================================================

function formatYen(value: number): string {

  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(value);
}

// ============================================================
// Subcomponents
// ============================================================

function CopyButton({ text }: { text: string }): React.ReactElement {
  const { t } = useI18n();

  const [copied, setCopied] = useState(false);

  function handleCopy(): void {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      aria-label={t('settings.conversions.h9e646d')}
    >
      {copied ? <Check size={12} className="text-green-500" /> : <Clipboard size={12} />}
      {copied ? t('settings.conversions.h93b4fb') : t('settings.conversions.h9e646d')}
    </button>
  );
}

function PlatformMappingBadge({
  label,
  enabled,
}: {
  label: string;
  enabled: boolean;
}): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        enabled
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
      )}
    >
      {enabled ? <Check size={10} /> : <X size={10} />}
      {label}
    </span>
  );
}

function EndpointCard({
  endpoint,
  onToggle,
  onEdit,
  onGetCode,
  onDelete,
}: {
  endpoint: TrackingEndpoint;
  onToggle: () => void;
  onEdit: () => void;
  onGetCode: () => void;
  onDelete: () => void;
}): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-foreground">{endpoint.name}</h3>
            <button
              type="button"
              onClick={onToggle}
              className={cn(
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                endpoint.active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600',
              )}
              role="switch"
              aria-checked={endpoint.active}
              aria-label={endpoint.active ? t('settings.conversions.h0277d5') : t('settings.conversions.hf32a54')}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
                  endpoint.active ? 'translate-x-5' : 'translate-x-0',
                )}
              />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded bg-muted px-2 py-0.5 text-xs text-foreground">
              {endpoint.pixelId}
            </code>
            <CopyButton text={endpoint.pixelId} />
          </div>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>{t('conversions.todayLabel')} <span className="font-medium text-foreground">{t('conversions.todayCount', { count: String(endpoint.statsToday) })}</span></p>
          <p>{t('conversions.thisWeekLabel')} <span className="font-medium text-foreground">{t('conversions.todayCount', { count: endpoint.statsWeek.toLocaleString() })}</span></p>
        </div>
      </div>

      {/* Domains */}
      <div className="mt-3">
        <p className="mb-1 text-xs text-muted-foreground">{t('conversions.allowedDomains')}</p>
        <div className="flex flex-wrap gap-1">
          {endpoint.domains.map((d) => (
            <span key={d} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground">
              <Globe size={10} />
              {d}
            </span>
          ))}
        </div>
      </div>

      {/* Event types */}
      <div className="mt-3">
        <p className="mb-1 text-xs text-muted-foreground">{t('conversions.eventTypeLabel')}</p>
        <div className="flex flex-wrap gap-1">
          {endpoint.eventTypes.map((et) => (
            <span key={et} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {getEventTypeLabels(t)[et]}
            </span>
          ))}
        </div>
      </div>

      {/* Platform mappings */}
      <div className="mt-3">
        <p className="mb-1 text-xs text-muted-foreground">{t('conversions.platformIntegration')}</p>
        <div className="flex flex-wrap gap-1">
          <PlatformMappingBadge label="Meta CAPI" enabled={endpoint.platformMapping.metaCapi} />
          <PlatformMappingBadge label="Google EC" enabled={endpoint.platformMapping.googleEc} />
          <PlatformMappingBadge label="TikTok" enabled={endpoint.platformMapping.tiktok} />
          <PlatformMappingBadge label="LINE/Yahoo" enabled={endpoint.platformMapping.lineYahoo} />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Settings2 size={14} />
          {t('settings.conversions.h041346')}
        </button>
        <button
          type="button"
          onClick={onGetCode}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Code2 size={14} />
          {t('settings.conversions.he5e724')}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          <Trash2 size={14} />
          {t('settings.conversions.hc6577c')}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Modals
// ============================================================

function CreateEditModal({
  open,
  onClose,
  editEndpoint,
}: {
  open: boolean;
  onClose: () => void;
  editEndpoint: TrackingEndpoint | null;
}): React.ReactElement | null {
  const { t } = useI18n();
  const [form, setForm] = useState<FormState>(() => ({
    name: editEndpoint?.name ?? '',
    domains: editEndpoint?.domains ?? [],
    domainInput: '',
    eventTypes: new Set<EventType>(editEndpoint?.eventTypes ?? []),
    platformMapping: editEndpoint?.platformMapping ?? { ...DEFAULT_PLATFORM_MAPPING },
  }));

  if (!open) return null;

  function handleAddDomain(): void {
    const trimmed = form.domainInput.trim();
    if (trimmed && !form.domains.includes(trimmed)) {
      setForm((prev) => ({
        ...prev,
        domains: [...prev.domains, trimmed],
        domainInput: '',
      }));
    }
  }

  function handleRemoveDomain(domain: string): void {
    setForm((prev) => ({
      ...prev,
      domains: prev.domains.filter((d) => d !== domain),
    }));
  }

  function handleToggleEventType(et: EventType): void {
    setForm((prev) => {
      const next = new Set(prev.eventTypes);
      if (next.has(et)) {
        next.delete(et);
      } else {
        next.add(et);
      }
      return { ...prev, eventTypes: next };
    });
  }

  function handlePlatformChange(
    key: keyof PlatformMapping,
    value: string | boolean,
  ): void {
    setForm((prev) => ({
      ...prev,
      platformMapping: { ...prev.platformMapping, [key]: value },
    }));
  }

  function handleDomainKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddDomain();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            {editEndpoint ? t('settings.conversions.h8c11c8') : t('settings.conversions.h413501')}
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={t('settings.conversions.h5dce86')}>
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* Name */}
          <div>
            <label htmlFor="endpoint-name" className="mb-1 block text-sm font-medium text-foreground">
              {t('settings.conversions.h34746f')}
            </label>
            <input
              id="endpoint-name"
              type="text"
              value={form.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={t('settings.conversions.h53dddd')}
            />
          </div>

          {/* Domains */}
          <div>
            <label htmlFor="domain-input" className="mb-1 block text-sm font-medium text-foreground">
              {t('settings.conversions.h496d55')}
            </label>
            <div className="flex gap-2">
              <input
                id="domain-input"
                type="text"
                value={form.domainInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((prev) => ({ ...prev, domainInput: e.target.value }))
                }
                onKeyDown={handleDomainKeyDown}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="example.com"
              />
              <button
                type="button"
                onClick={handleAddDomain}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t('settings.conversions.h7dc3a5')}
              </button>
            </div>
            {form.domains.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {form.domains.map((d) => (
                  <span key={d} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground">
                    {d}
                    <button
                      type="button"
                      onClick={() => handleRemoveDomain(d)}
                      className="rounded-full hover:text-red-500"
                      aria-label={t('conversions.ariaDeleteDomain', { domain: d })}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Event types */}
          <div>
            <span className="mb-2 block text-sm font-medium text-foreground">{t('conversions.eventTypeLabel')}</span>
            <div className="space-y-2">
              {EVENT_TYPE_OPTIONS.map((et) => (
                <label key={et} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={form.eventTypes.has(et)}
                    onChange={() => handleToggleEventType(et)}
                    className="rounded border-input"
                  />
                  {getEventTypeLabels(t)[et]}
                </label>
              ))}
            </div>
          </div>

          {/* Platform integrations */}
          <div className="space-y-4">
            <span className="block text-sm font-medium text-foreground">{t('conversions.platformIntegration')}</span>

            {/* Meta */}
            <div className="rounded-md border border-border p-3">
              <label className="flex items-center justify-between text-sm font-medium text-foreground">
                Meta CAPI
                <input
                  type="checkbox"
                  checked={form.platformMapping.metaCapi}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePlatformChange('metaCapi', e.target.checked)}
                  className="rounded border-input"
                />
              </label>
              {form.platformMapping.metaCapi && (
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    value={form.platformMapping.metaPixelId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePlatformChange('metaPixelId', e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Pixel ID"
                  />
                  <input
                    type="text"
                    value={form.platformMapping.metaAccessToken}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePlatformChange('metaAccessToken', e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Access Token"
                  />
                </div>
              )}
            </div>

            {/* Google */}
            <div className="rounded-md border border-border p-3">
              <label className="flex items-center justify-between text-sm font-medium text-foreground">
                Google EC
                <input
                  type="checkbox"
                  checked={form.platformMapping.googleEc}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePlatformChange('googleEc', e.target.checked)}
                  className="rounded border-input"
                />
              </label>
              {form.platformMapping.googleEc && (
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    value={form.platformMapping.googleConversionId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePlatformChange('googleConversionId', e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Conversion ID (AW-...)"
                  />
                  <input
                    type="text"
                    value={form.platformMapping.googleLabel}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePlatformChange('googleLabel', e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Label"
                  />
                </div>
              )}
            </div>

            {/* TikTok */}
            <div className="rounded-md border border-border p-3">
              <label className="flex items-center justify-between text-sm font-medium text-foreground">
                TikTok
                <input
                  type="checkbox"
                  checked={form.platformMapping.tiktok}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePlatformChange('tiktok', e.target.checked)}
                  className="rounded border-input"
                />
              </label>
              {form.platformMapping.tiktok && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={form.platformMapping.tiktokPixelId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePlatformChange('tiktokPixelId', e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Pixel ID"
                  />
                </div>
              )}
            </div>

            {/* LINE/Yahoo */}
            <div className="rounded-md border border-border p-3">
              <label className="flex items-center justify-between text-sm font-medium text-foreground">
                LINE/Yahoo
                <input
                  type="checkbox"
                  checked={form.platformMapping.lineYahoo}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePlatformChange('lineYahoo', e.target.checked)}
                  className="rounded border-input"
                />
              </label>
              {form.platformMapping.lineYahoo && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={form.platformMapping.lineYahooTagId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePlatformChange('lineYahooTagId', e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Tag ID"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              {t('settings.conversions.h6ef349')}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {editEndpoint ? t('settings.conversions.hbe5fbb') : t('settings.conversions.h4f8c0a')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CodeModal({
  open,
  onClose,
  endpoint,
}: {
  open: boolean;
  onClose: () => void;
  endpoint: TrackingEndpoint | null;
}): React.ReactElement | null {
  const { t } = useI18n();
  if (!open || !endpoint) return null;

  const pixelSnippet = `<!-- OMNI-AD Conversion Tracking -->
<script>
!function(o,m,n,i){o.OmniAd=o.OmniAd||function(){
(o.OmniAd.q=o.OmniAd.q||[]).push(arguments)};
var s=m.createElement('script');s.async=1;
s.src='https://track.omni-ad.jp/pixel.js';
m.head.appendChild(s)}(window,document);
OmniAd('init', '${endpoint.pixelId}');
</script>`;

  const eventExamples = `// Purchase
OmniAd('track', 'purchase', { value: 29800, currency: 'JPY' });

// Lead
OmniAd('track', 'lead', { email: 'user@example.com' });

// Add to Cart
OmniAd('track', 'add_to_cart', { value: 5980, item: 'Product A' });`;

  const curlExample = `curl -X POST https://api.omni-ad.jp/v1/events \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "pixel_id": "${endpoint.pixelId}",
    "event": "purchase",
    "value": 29800,
    "currency": "JPY",
    "user_data": {
      "email_hash": "sha256_hash_here"
    }
  }'`;

  const gtmInstructions = `1. Log in to Google Tag Manager
2. New Tag > Custom HTML
3. Paste the pixel code above
4. Set trigger: All Pages
5. Link event tags to page triggers`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">{t('conversions.integrationCodeTitle', { name: endpoint.name })}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={t('settings.conversions.h5dce86')}>
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* Pixel snippet */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t('conversions.pixelCodeHtml')}</h3>
              <CopyButton text={pixelSnippet} />
            </div>
            <pre className="overflow-x-auto rounded-md bg-gray-900 p-4 text-xs text-gray-100">
              <code>{pixelSnippet}</code>
            </pre>
          </div>

          {/* Event examples */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t('conversions.eventExamplesJs')}</h3>
              <CopyButton text={eventExamples} />
            </div>
            <pre className="overflow-x-auto rounded-md bg-gray-900 p-4 text-xs text-gray-100">
              <code>{eventExamples}</code>
            </pre>
          </div>

          {/* Server-side */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t('conversions.serverSideApi')}</h3>
              <CopyButton text={curlExample} />
            </div>
            <pre className="overflow-x-auto rounded-md bg-gray-900 p-4 text-xs text-gray-100">
              <code>{curlExample}</code>
            </pre>
          </div>

          {/* GTM */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">
              <ExternalLink size={14} className="mr-1 inline" />
              {t('conversions.gtmIntegration')}
            </h3>
            <div className="rounded-md bg-muted/50 p-4">
              <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{gtmInstructions}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function ConversionsPage(): React.ReactElement {
  const { t } = useI18n();
  const [endpoints, setEndpoints] = useState<TrackingEndpoint[]>(getMockEndpoints(t));
  const [modalMode, setModalMode] = useState<ModalMode>('closed');
  const [editTarget, setEditTarget] = useState<TrackingEndpoint | null>(null);
  const [codeTarget, setCodeTarget] = useState<TrackingEndpoint | null>(null);

  function handleToggleEndpoint(id: string): void {
    setEndpoints((prev) =>
      prev.map((ep) => (ep.id === id ? { ...ep, active: !ep.active } : ep)),
    );
  }

  function handleOpenCreate(): void {
    setEditTarget(null);
    setModalMode('create');
  }

  function handleOpenEdit(endpoint: TrackingEndpoint): void {
    setEditTarget(endpoint);
    setModalMode('edit');
  }

  function handleOpenCode(endpoint: TrackingEndpoint): void {
    setCodeTarget(endpoint);
    setModalMode('code');
  }

  function handleCloseModal(): void {
    setModalMode('closed');
    setEditTarget(null);
    setCodeTarget(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t('settings.conversions.h631116')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('conversions.serverSideDesc')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus size={16} />
          {t('settings.conversions.h413501')}
        </button>
      </div>

      {/* Endpoint cards */}
      <div className="space-y-4">
        {endpoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16 text-center">
            <Code2 size={40} className="mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">{t('conversions.noEndpoints')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('settings.conversions.h79dcf4')}
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus size={16} />
              {t('settings.conversions.h413501')}
            </button>
          </div>
        ) : (
          endpoints.map((ep) => (
            <EndpointCard
              key={ep.id}
              endpoint={ep}
              onToggle={() => handleToggleEndpoint(ep.id)}
              onEdit={() => handleOpenEdit(ep)}
              onGetCode={() => handleOpenCode(ep)}
              onDelete={() => setEndpoints((prev) => prev.filter((e) => e.id !== ep.id))}
            />
          ))
        )}
      </div>

      {/* Conversion Dashboard */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-foreground">{t('conversions.dashboardTitle')}</h2>

        {/* Daily events chart */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-semibold text-foreground">{t('conversions.dailyChartTitle')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={MOCK_DAILY_CONVERSIONS} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                }}
              />
              <Legend />
              <Bar dataKey="purchase" name={t('settings.conversions.h57997c')} stackId="a" fill="hsl(262, 83%, 58%)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="lead" name={t('settings.conversions.had963b')} stackId="a" fill="hsl(221, 83%, 53%)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="addToCart" name={t('settings.conversions.hfc18be')} stackId="a" fill="hsl(142, 71%, 45%)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="signup" name={t('settings.conversions.hfc96d0')} stackId="a" fill="hsl(25, 95%, 53%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Platform sync status */}
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-6 py-4">
            <h3 className="text-base font-semibold text-foreground">{t('conversions.syncStatusTitle')}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('conversions.syncPlatform')}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('conversions.thSent')}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('conversions.thConfirmed')}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('conversions.thSuccessRate')}</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_SYNC_STATUS.map((row) => (
                  <tr key={row.platform} className="border-b border-border transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{row.platform}</td>
                    <td className="px-4 py-3 text-right text-foreground">{row.sent.toLocaleString('ja-JP')}</td>
                    <td className="px-4 py-3 text-right text-foreground">{row.confirmed.toLocaleString('ja-JP')}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn(
                        'font-semibold',
                        row.rate >= 98 ? 'text-green-600' : row.rate >= 95 ? 'text-yellow-600' : 'text-red-600',
                      )}>
                        {row.rate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent events */}
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-6 py-4">
            <h3 className="text-base font-semibold text-foreground">{t('conversions.recentEventsTitle')}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('conversions.thDatetime')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('conversions.thType')}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('conversions.thAmount')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('conversions.thSource')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('conversions.thIntegrationDest')}</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_RECENT_EVENTS.map((event) => (
                  <tr key={event.id} className="border-b border-border transition-colors hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {event.timestamp}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {getEventTypeLabels(t)[event.eventType]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">
                      {event.value !== null ? formatYen(event.value) : '--'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{event.sourceUrl}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {event.platformMatched.map((p) => (
                          <span key={p} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateEditModal
        open={modalMode === 'create' || modalMode === 'edit'}
        onClose={handleCloseModal}
        editEndpoint={editTarget}
      />
      <CodeModal
        open={modalMode === 'code'}
        onClose={handleCloseModal}
        endpoint={codeTarget}
      />
    </div>
  );
}
