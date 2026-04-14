'use client';

import { useState, useCallback } from 'react';
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  FolderKanban,
  Globe,
  Image,
  Link2,
  Loader2,
  Monitor,
  Pause,
  Play,
  Plus,
  Search,
  Sliders,
  Smartphone,
  Sparkles,
  Tablet,
  Target,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { Badge, Button, PageHeader, PlatformBadge, PlatformIcon } from '@omni-ad/ui';
import { dbPlatformToEnum } from '@omni-ad/shared';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { ExportButton } from '@/app/components/export-button';
import { useI18n } from '@/lib/i18n';

// ============================================================
// Types
// ============================================================

type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
type Platform = 'meta' | 'google' | 'x' | 'tiktok' | 'line_yahoo' | 'amazon' | 'microsoft';
type Objective = 'awareness' | 'traffic' | 'engagement' | 'leads' | 'conversion' | 'retargeting';
type BidStrategy = 'auto_maximize_conversions' | 'auto_target_cpa' | 'auto_target_roas' | 'manual_cpc';
type Gender = 'male' | 'female' | 'unspecified';
type Device = 'mobile' | 'desktop' | 'tablet' | 'all';
type CampaignTab = 0 | 1 | 2 | 3 | 4;

type SortField = 'name' | 'status' | 'budget' | 'roas' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  platforms: Platform[];
  budget: { total: number; currency: string; dailyLimit?: number };
  roas: number;
  updatedAt: string;
  objective: Objective;
}

// ============================================================
// Constants
// ============================================================

type StatusVariant = 'neutral' | 'success' | 'warning' | 'info' | 'destructive';

const STATUS_CONFIG: Record<CampaignStatus, { labelKey: string; variant: StatusVariant }> = {
  draft: { labelKey: 'campaigns.status.draft', variant: 'neutral' },
  active: { labelKey: 'campaigns.status.active', variant: 'success' },
  paused: { labelKey: 'campaigns.status.paused', variant: 'warning' },
  completed: { labelKey: 'campaigns.status.completed', variant: 'info' },
  archived: { labelKey: 'campaigns.status.archived', variant: 'destructive' },
};


const ALL_STATUSES: CampaignStatus[] = ['draft', 'active', 'paused', 'completed', 'archived'];

const PLATFORM_CONFIG: Record<Platform, { label: string; color: string }> = {
  meta: { label: 'Meta', color: 'bg-indigo-500' },
  google: { label: 'Google', color: 'bg-blue-500' },
  x: { label: 'X', color: 'bg-gray-700' },
  tiktok: { label: 'TikTok', color: 'bg-pink-500' },
  line_yahoo: { label: 'LINE/Yahoo', color: 'bg-green-500' },
  amazon: { label: 'Amazon', color: 'bg-orange-500' },
  microsoft: { label: 'Microsoft', color: 'bg-teal-500' },
};

const ALL_PLATFORMS: Platform[] = ['meta', 'google', 'x', 'tiktok', 'line_yahoo', 'amazon', 'microsoft'];

const OBJECTIVE_KEYS: { value: Objective; labelKey: string }[] = [
  { value: 'awareness', labelKey: 'campaigns.objectiveAwareness' },
  { value: 'traffic', labelKey: 'campaigns.objectiveTraffic' },
  { value: 'engagement', labelKey: 'campaigns.objectiveEngagement' },
  { value: 'leads', labelKey: 'campaigns.objectiveLeads' },
  { value: 'conversion', labelKey: 'campaigns.objectiveConversion' },
  { value: 'retargeting', labelKey: 'campaigns.objectiveRetargeting' },
];

const OBJECTIVE_LABEL_KEYS: Record<Objective, string> = {
  awareness: 'campaigns.objectiveAwareness',
  traffic: 'campaigns.objectiveTraffic',
  engagement: 'campaigns.objectiveEngagement',
  leads: 'campaigns.objectiveLeads',
  conversion: 'campaigns.objectiveConversion',
  retargeting: 'campaigns.objectiveRetargeting',
};

const TABLE_COLUMNS: { key: SortField | 'platforms' | 'actions'; labelKey: string; sortable: boolean }[] = [
  { key: 'name', labelKey: 'common.name', sortable: true },
  { key: 'status', labelKey: 'common.status', sortable: true },
  { key: 'platforms', labelKey: 'campaigns.platforms', sortable: false },
  { key: 'budget', labelKey: 'campaigns.budget', sortable: true },
  { key: 'roas', labelKey: 'campaigns.roas', sortable: true },
  { key: 'updatedAt', labelKey: 'campaigns.updatedAt', sortable: true },
  { key: 'actions', labelKey: 'campaigns.actions', sortable: false },
];

// Export columns are resolved at render time using t()
const EXPORT_COLUMN_DEFS = [
  { key: 'name' as const, labelKey: 'campaigns.name' },
  { key: 'status' as const, labelKey: 'common.status', format: (v: Campaign[keyof Campaign]) => STATUS_CONFIG[v as CampaignStatus]?.labelKey ?? String(v) },
  { key: 'platforms' as const, labelKey: 'campaigns.platforms', format: (v: Campaign[keyof Campaign]) => (v as Platform[]).map((p) => PLATFORM_CONFIG[p]?.label ?? p).join(', ') },
  { key: 'budget' as const, labelKey: 'campaigns.budget', format: (v: Campaign[keyof Campaign]) => String((v as Campaign['budget']).total) },
  { key: 'roas' as const, labelKey: 'campaigns.roas', format: (v: Campaign[keyof Campaign]) => `${Number(v).toFixed(1)}x` },
  { key: 'objective' as const, labelKey: 'campaigns.objective', format: (v: Campaign[keyof Campaign]) => OBJECTIVE_LABEL_KEYS[v as Objective] ?? String(v) },
  { key: 'updatedAt' as const, labelKey: 'campaigns.updatedAt' },
];

const CAMPAIGN_TABS: { labelKey: string; icon: React.ReactNode }[] = [
  { labelKey: 'campaigns.basicInfo', icon: <Globe size={14} /> },
  { labelKey: 'campaigns.conversionSettings', icon: <Target size={14} /> },
  { labelKey: 'campaigns.targeting', icon: <Users size={14} /> },
  { labelKey: 'campaigns.creative', icon: <Image size={14} /> },
  { labelKey: 'campaigns.platform', icon: <Sliders size={14} /> },
];

const BID_STRATEGY_OPTIONS: { value: BidStrategy; labelKey: string; descKey: string }[] = [
  { value: 'auto_maximize_conversions', labelKey: 'campaigns.bidMaxConversions', descKey: 'campaigns.bidMaxConversionsDesc' },
  { value: 'auto_target_cpa', labelKey: 'campaigns.bidTargetCpa', descKey: 'campaigns.bidTargetCpaDesc' },
  { value: 'auto_target_roas', labelKey: 'campaigns.bidTargetRoas', descKey: 'campaigns.bidTargetRoasDesc' },
  { value: 'manual_cpc', labelKey: 'campaigns.bidManualCpc', descKey: 'campaigns.bidManualCpcDesc' },
];

function getConversionPoints(t: (key: string, params?: Record<string, string | number>) => string) {
  return [t('campaigns.hcb222d'), t('campaigns.h41ac90'), t('campaigns.hf06d76')] as const;
}

function getAgeOptions() {
  return ['18', '20', '25', '30', '35', '40', '45', '50', '55', '60', '65+'] as const;
}

function getRegionSuggestions(t: (key: string, params?: Record<string, string | number>) => string) {
  return [t('campaigns.h707ba1'), t('campaigns.hd94e2b'), t('campaigns.h20b7eb'), t('campaigns.h81fd0e'), t('campaigns.haf0713'), t('campaigns.he31419'), t('campaigns.hcda9a8'), t('campaigns.h841dd1'), t('campaigns.h030dd7'), t('campaigns.h403713')] as const;
}

function getInterestSuggestions(t: (key: string, params?: Record<string, string | number>) => string) {
  return [t('campaigns.h081747'), t('campaigns.hb93315'), t('campaigns.h85da04'), t('campaigns.hf11732'), t('campaigns.h874834'), t('campaigns.hc9aa09'), t('campaigns.h9d859b'), t('campaigns.h8e545f'), t('campaigns.h054653'), t('campaigns.h8640cb')] as const;
}

function getExclusionAudiences(t: (key: string, params?: Record<string, string | number>) => string) {
  return [t('campaigns.h6b9f86'), t('campaigns.hf666f2'), t('campaigns.hb7b07f')] as const;
}

function getMockExistingCreatives(t: (key: string, params?: Record<string, string | number>) => string) {
  return [
  { id: 'c1', name: t('campaigns.h017432'), thumbnail: '' },
  { id: 'c2', name: t('campaigns.hf90c9c'), thumbnail: '' },
  { id: 'c3', name: t('campaigns.h1c0e47'), thumbnail: '' },
  { id: 'c4', name: t('campaigns.h824c21'), thumbnail: '' },
  { id: 'c5', name: t('campaigns.ha20bff'), thumbnail: '' },
  { id: 'c6', name: t('campaigns.h96e1ed'), thumbnail: '' },
];
}

// ============================================================
// Mock data
// ============================================================

function getMockCampaigns(t: (key: string, params?: Record<string, string | number>) => string): Campaign[] {
  return [
  {
    id: '1', name: t('campaigns.hc6f094'), status: 'active',
    platforms: ['google', 'meta', 'line_yahoo'],
    budget: { total: 500000, currency: 'JPY', dailyLimit: 50000 },
    roas: 3.2, updatedAt: '2026-04-01T10:00:00Z', objective: 'conversion',
  },
  {
    id: '2', name: t('campaigns.haa8e92'), status: 'paused',
    platforms: ['tiktok'],
    budget: { total: 200000, currency: 'JPY' },
    roas: 1.8, updatedAt: '2026-03-28T14:30:00Z', objective: 'leads',
  },
  {
    id: '3', name: t('campaigns.h986608'), status: 'draft',
    platforms: ['google', 'meta', 'x', 'line_yahoo'],
    budget: { total: 1000000, currency: 'JPY', dailyLimit: 100000 },
    roas: 0, updatedAt: '2026-03-25T09:00:00Z', objective: 'awareness',
  },
  {
    id: '4', name: t('campaigns.h44c4f0'), status: 'completed',
    platforms: ['google', 'meta', 'line_yahoo', 'amazon'],
    budget: { total: 800000, currency: 'JPY' },
    roas: 4.5, updatedAt: '2026-01-15T18:00:00Z', objective: 'retargeting',
  },
  {
    id: '5', name: t('campaigns.h72fcf2'), status: 'draft',
    platforms: ['google', 'meta', 'tiktok'],
    budget: { total: 600000, currency: 'JPY', dailyLimit: 60000 },
    roas: 0, updatedAt: '2026-04-02T08:00:00Z', objective: 'conversion',
  },
  {
    id: '6', name: t('campaigns.h5f8f25'), status: 'active',
    platforms: ['line_yahoo'],
    budget: { total: 300000, currency: 'JPY', dailyLimit: 30000 },
    roas: 2.6, updatedAt: '2026-04-01T16:00:00Z', objective: 'engagement',
  },
];
}

// ============================================================
// Subcomponents
// ============================================================

function StatusBadge({ status }: { status: CampaignStatus }): React.ReactElement {
  const { t } = useI18n();
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} size="md" dot={status === 'active'}>
      {t(config.labelKey)}
    </Badge>
  );
}

function PlatformBadges({ platforms }: { platforms: Platform[] }): React.ReactElement {
  if (platforms.length <= 3) {
    return (
      <div className="flex flex-wrap gap-1">
        {platforms.map((p) => (
          <PlatformBadge
            key={p}
            platform={dbPlatformToEnum(p)}
            size="sm"
            showLabel={false}
          />
        ))}
      </div>
    );
  }
  // When many platforms are active, fall back to a stacked group of icons
  // with a count chip to keep the row height tight.
  return (
    <div className="flex items-center gap-1">
      <div className="flex -space-x-1.5">
        {platforms.slice(0, 3).map((p) => (
          <div
            key={p}
            className="grid h-5 w-5 place-items-center rounded-full border-2 border-card bg-card shadow-xs"
            title={PLATFORM_CONFIG[p].label}
          >
            <PlatformIcon platform={dbPlatformToEnum(p)} size={11} />
          </div>
        ))}
      </div>
      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        +{platforms.length - 3}
      </span>
    </div>
  );
}

interface SortHeaderProps {
  label: string;
  field: SortField;
  currentField: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
}

function SortHeader({ label, field, currentField, direction, onSort }: SortHeaderProps): React.ReactElement {
  const isActive = currentField === field;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-left font-medium text-muted-foreground hover:text-foreground"
      onClick={() => onSort(field)}
    >
      {label}
      <ArrowUpDown
        size={14}
        className={cn('transition-colors', isActive ? 'text-foreground' : 'text-muted-foreground/40')}
        style={isActive && direction === 'desc' ? { transform: 'scaleY(-1)' } : undefined}
      />
    </button>
  );
}

function SkeletonRow(): React.ReactElement {
  return (
    <tr className="animate-pulse border-b border-border">
      <td className="px-4 py-3"><div className="h-4 w-4 rounded bg-muted" /></td>
      {TABLE_COLUMNS.map((col) => (
        <td key={col.key} className="px-4 py-3">
          <div className="h-4 w-20 rounded bg-muted" />
        </td>
      ))}
    </tr>
  );
}

// -- Campaign Detail Modal --

interface CampaignDetailModalProps {
  campaign: Campaign;
  onClose: () => void;
}

function CampaignDetailModal({ campaign, onClose }: CampaignDetailModalProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">{campaign.name}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4 p-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">{t('common.status')}</p>
              <StatusBadge status={campaign.status} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('campaigns.objective')}</p>
              <p className="text-sm font-medium text-foreground">{t(OBJECTIVE_LABEL_KEYS[campaign.objective])}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('campaigns.totalBudget')}</p>
              <p className="text-sm font-medium text-foreground">
                {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(campaign.budget.total)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ROAS</p>
              <p className={cn(
                'text-sm font-semibold',
                campaign.roas >= 3 ? 'text-green-600' : campaign.roas >= 1 ? 'text-yellow-600' : 'text-muted-foreground',
              )}>
                {campaign.roas > 0 ? `${campaign.roas.toFixed(1)}x` : '--'}
              </p>
            </div>
            {campaign.budget.dailyLimit && (
              <div>
                <p className="text-xs text-muted-foreground">{t('campaigns.dailyLimit')}</p>
                <p className="text-sm text-foreground">
                  {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(campaign.budget.dailyLimit)}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">{t('campaigns.updatedAt')}</p>
              <p className="text-sm text-foreground">
                {new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(campaign.updatedAt))}
              </p>
            </div>
          </div>

          {/* Platforms */}
          <div>
            <p className="mb-2 text-xs text-muted-foreground">{t('campaigns.deliveryPlatforms')}</p>
            <PlatformBadges platforms={campaign.platforms} />
          </div>

          {/* Change history stub */}
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">{t('campaigns.changeHistory')}</p>
            <div className="space-y-2">
              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                {t('campaigns.historyBudgetChange')}
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                {t('campaigns.historyStatusChange')}
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                {t('campaigns.historyCreated')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// -- Create Campaign Modal (Expanded Wizard) --

interface CreateCampaignModalProps {
  open: boolean;
  onClose: () => void;
}

function TagInput({
  label,
  tags,
  onAdd,
  onRemove,
  suggestions,
  placeholder,
  id,
}: {
  label: string;
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  suggestions: readonly string[];
  placeholder: string;
  id: string;
}): React.ReactElement {
  const { t } = useI18n();
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredSuggestions = suggestions.filter(
    (s) => !tags.includes(s) && s.includes(inputValue),
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      onAdd(inputValue.trim());
      setInputValue('');
    }
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          value={inputValue}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={placeholder}
        />
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute left-0 z-10 mt-1 max-h-32 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
            {filteredSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.preventDefault();
                  onAdd(s);
                  setInputValue('');
                  setShowSuggestions(false);
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
            >
              {tag}
              <button
                type="button"
                onClick={() => onRemove(tag)}
                className="rounded-full p-0.5 hover:bg-primary/20"
                aria-label={t('campaigns.ariaDeleteTag', { tag })}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateCampaignModal({ open, onClose }: CreateCampaignModalProps): React.ReactElement | null {
  const { t } = useI18n();
  const [currentTab, setCurrentTab] = useState<CampaignTab>(0);

  // Tab 1: Basic Info
  const [name, setName] = useState('');
  const [objective, setObjective] = useState<Objective>('conversion');
  const [budgetTotal, setBudgetTotal] = useState('');
  const [dailyLimit, setDailyLimit] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [landingPageUrl, setLandingPageUrl] = useState('');
  const [bidStrategy, setBidStrategy] = useState<BidStrategy>('auto_maximize_conversions');
  const [targetCpa, setTargetCpa] = useState('');
  const [targetRoas, setTargetRoas] = useState('');

  // Tab 2: Conversion Settings
  const [conversionPoint, setConversionPoint] = useState<string>(getConversionPoints(t)[0]);
  const [cpaAlertLimit, setCpaAlertLimit] = useState('');
  const [roasAlertMin, setRoasAlertMin] = useState('');
  const [ctrAlertMin, setCtrAlertMin] = useState('');

  // Tab 3: Targeting
  const [ageMin, setAgeMin] = useState('18');
  const [ageMax, setAgeMax] = useState('65+');
  const [genders, setGenders] = useState<Gender[]>(['unspecified']);
  const [regions, setRegions] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [devices, setDevices] = useState<Device[]>(['all']);
  const [exclusionAudiences, setExclusionAudiences] = useState<string[]>([]);

  // Tab 4: Creative
  const [selectedCreativeIds, setSelectedCreativeIds] = useState<string[]>([]);
  const [aiAutoGenerate, setAiAutoGenerate] = useState(false);
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('cpc');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmContent, setUtmContent] = useState('');

  // Tab 5: Platforms
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [platformBudgetAllocation, setPlatformBudgetAllocation] = useState<Record<Platform, number>>({
    meta: 0, google: 0, x: 0, tiktok: 0, line_yahoo: 0, amazon: 0, microsoft: 0,
  });

  const createMutation = trpc.campaigns.create.useMutation({
    onSuccess: () => {
      onClose();
    },
  });

  // Auto-generate UTM when campaign name changes
  const updateUtmFromName = useCallback((campaignName: string) => {
    const slug = campaignName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    setUtmCampaign(slug || '');
  }, []);

  function togglePlatform(platform: Platform): void {
    setSelectedPlatforms((prev) => {
      const next = prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform];
      // Redistribute budget allocation evenly
      if (next.length > 0) {
        const evenShare = Math.floor(100 / next.length);
        const remainder = 100 - evenShare * next.length;
        const newAllocation = { ...platformBudgetAllocation };
        ALL_PLATFORMS.forEach((p) => {
          newAllocation[p] = next.includes(p) ? evenShare : 0;
        });
        const firstPlatform = next[0];
        if (next.length > 0 && firstPlatform) {
          newAllocation[firstPlatform] += remainder;
        }
        setPlatformBudgetAllocation(newAllocation);
      }
      return next;
    });
  }

  function toggleGender(g: Gender): void {
    setGenders((prev) =>
      prev.includes(g) ? prev.filter((v) => v !== g) : [...prev, g],
    );
  }

  function toggleDevice(d: Device): void {
    if (d === 'all') {
      setDevices(['all']);
      return;
    }
    setDevices((prev) => {
      const withoutAll = prev.filter((v) => v !== 'all');
      const next = withoutAll.includes(d)
        ? withoutAll.filter((v) => v !== d)
        : [...withoutAll, d];
      return next.length === 0 ? ['all'] : next;
    });
  }

  function toggleCreative(id: string): void {
    setSelectedCreativeIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  }

  function toggleExclusionAudience(audience: string): void {
    setExclusionAudiences((prev) =>
      prev.includes(audience) ? prev.filter((v) => v !== audience) : [...prev, audience],
    );
  }

  function handlePlatformBudgetChange(platform: Platform, value: number): void {
    setPlatformBudgetAllocation((prev) => ({ ...prev, [platform]: value }));
  }

  function canAdvanceTab(tab: CampaignTab): boolean {
    switch (tab) {
      case 0:
        return Boolean(name && budgetTotal && startDate);
      case 1:
        return true;
      case 2:
        return true;
      case 3:
        return true;
      case 4:
        return selectedPlatforms.length > 0;
      default:
        return true;
    }
  }

  function handleSubmit(): void {
    if (!name || !budgetTotal || selectedPlatforms.length === 0 || !startDate) return;

    createMutation.mutate({
      name,
      objective,
      totalBudget: budgetTotal,
      dailyBudget: dailyLimit || budgetTotal,
      startDate,
      endDate: endDate || undefined,
    });
  }

  if (!open) return null;

  const inputCls = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';
  const labelCls = 'mb-1 block text-sm font-medium text-foreground';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-2xl flex-col rounded-lg border border-border bg-card shadow-xl" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">{t('campaigns.createTitle')}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex border-b border-border" role="tablist" aria-label={t('campaigns.campaignSteps')}>
          {CAMPAIGN_TABS.map((tab, index) => {
            const tabIndex = index as CampaignTab;
            const isCurrent = currentTab === tabIndex;
            const isCompleted = currentTab > tabIndex;
            return (
              <button
                key={tab.labelKey}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                aria-controls={`campaign-tab-panel-${index}`}
                onClick={() => setCurrentTab(tabIndex)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-xs font-medium transition-colors',
                  isCurrent
                    ? 'border-primary text-primary'
                    : isCompleted
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {isCompleted ? <Check size={12} className="text-green-500" /> : tab.icon}
                <span className="hidden sm:inline">{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Tab 1: Basic Info */}
          {currentTab === 0 && (
            <div className="space-y-4" id="campaign-tab-panel-0" role="tabpanel">
              <div>
                <label htmlFor="campaign-name" className={labelCls}>{t('campaigns.name')}</label>
                <input
                  id="campaign-name"
                  type="text"
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setName(e.target.value);
                    updateUtmFromName(e.target.value);
                  }}
                  className={inputCls}
                  placeholder={t('campaigns.campaignNamePlaceholder')}
                  required
                />
              </div>

              <div>
                <label htmlFor="campaign-objective" className={labelCls}>{t('campaigns.objective')}</label>
                <div className="relative">
                  <select
                    id="campaign-objective"
                    value={objective}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setObjective(e.target.value as Objective)}
                    className={cn(inputCls, 'appearance-none pr-8')}
                  >
                    {OBJECTIVE_KEYS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="campaign-budget" className={labelCls}>{t('campaigns.totalBudgetJpy')}</label>
                  <input
                    id="campaign-budget"
                    type="number"
                    value={budgetTotal}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBudgetTotal(e.target.value)}
                    className={inputCls}
                    placeholder="500000"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="campaign-daily-limit" className={labelCls}>{t('campaigns.dailyLimitOptional')}</label>
                  <input
                    id="campaign-daily-limit"
                    type="number"
                    value={dailyLimit}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDailyLimit(e.target.value)}
                    className={inputCls}
                    placeholder="50000"
                    min="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="campaign-start" className={labelCls}>{t('campaigns.startDate')}</label>
                  <input
                    id="campaign-start"
                    type="date"
                    value={startDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="campaign-end" className={labelCls}>{t('campaigns.endDateOptional')}</label>
                  <input
                    id="campaign-end"
                    type="date"
                    value={endDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="campaign-lp-url" className={labelCls}>
                  <span className="flex items-center gap-1.5">
                    <Link2 size={14} />
                    {t('campaigns.landingPageUrl')}
                  </span>
                </label>
                <input
                  id="campaign-lp-url"
                  type="url"
                  value={landingPageUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLandingPageUrl(e.target.value)}
                  className={inputCls}
                  placeholder="https://example.com/landing"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('campaigns.landingPageHint')}
                </p>
              </div>

              <div>
                <span className="mb-2 block text-sm font-medium text-foreground">{t('campaigns.bidStrategy')}</span>
                <div className="space-y-2">
                  {BID_STRATEGY_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                        bidStrategy === option.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/30',
                      )}
                    >
                      <input
                        type="radio"
                        name="bid-strategy"
                        value={option.value}
                        checked={bidStrategy === option.value}
                        onChange={() => setBidStrategy(option.value)}
                        className="mt-0.5 accent-primary"
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">{t(option.labelKey)}</p>
                        <p className="text-xs text-muted-foreground">{t(option.descKey)}</p>
                      </div>
                    </label>
                  ))}
                </div>
                {bidStrategy === 'auto_target_cpa' && (
                  <div className="mt-3">
                    <label htmlFor="bid-target-cpa" className={labelCls}>{t('campaigns.targetCpaJpy')}</label>
                    <input
                      id="bid-target-cpa"
                      type="number"
                      value={targetCpa}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetCpa(e.target.value)}
                      className={inputCls}
                      placeholder="3000"
                      min="1"
                    />
                  </div>
                )}
                {bidStrategy === 'auto_target_roas' && (
                  <div className="mt-3">
                    <label htmlFor="bid-target-roas" className={labelCls}>{t('campaigns.targetRoasMultiple')}</label>
                    <input
                      id="bid-target-roas"
                      type="number"
                      value={targetRoas}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetRoas(e.target.value)}
                      className={inputCls}
                      placeholder="3.0"
                      min="0"
                      step="0.1"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Conversion Settings */}
          {currentTab === 1 && (
            <div className="space-y-5" id="campaign-tab-panel-1" role="tabpanel">
              <div>
                <label htmlFor="conversion-point" className={labelCls}>{t('campaigns.conversionPoint')}</label>
                <div className="relative">
                  <select
                    id="conversion-point"
                    value={conversionPoint}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setConversionPoint(e.target.value)
                    }
                    className={cn(inputCls, 'appearance-none pr-8')}
                  >
                    {getConversionPoints(t).map((cp) => (
                      <option key={cp} value={cp}>{cp}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              {bidStrategy === 'auto_target_cpa' && (
                <div>
                  <label htmlFor="cv-target-cpa" className={labelCls}>{t('campaigns.targetCpaJpy')}</label>
                  <input
                    id="cv-target-cpa"
                    type="number"
                    value={targetCpa}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetCpa(e.target.value)}
                    className={inputCls}
                    placeholder="3000"
                    min="1"
                  />
                </div>
              )}

              {bidStrategy === 'auto_target_roas' && (
                <div>
                  <label htmlFor="cv-target-roas" className={labelCls}>{t('campaigns.targetRoasMultiple')}</label>
                  <input
                    id="cv-target-roas"
                    type="number"
                    value={targetRoas}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetRoas(e.target.value)}
                    className={inputCls}
                    placeholder="3.0"
                    min="0"
                    step="0.1"
                  />
                </div>
              )}

              <div className="rounded-lg border border-border p-4">
                <h4 className="mb-3 text-sm font-semibold text-foreground">{t('campaigns.kpiAlertSettings')}</h4>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="alert-cpa-limit" className={labelCls}>
                      {t('campaigns.cpaUpperLimit')}
                    </label>
                    <input
                      id="alert-cpa-limit"
                      type="number"
                      value={cpaAlertLimit}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCpaAlertLimit(e.target.value)}
                      className={inputCls}
                      placeholder="5000"
                      min="1"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{t('campaigns.cpaAlertHint')}</p>
                  </div>
                  <div>
                    <label htmlFor="alert-roas-min" className={labelCls}>{t('campaigns.roasLowerLimit')}</label>
                    <input
                      id="alert-roas-min"
                      type="number"
                      value={roasAlertMin}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRoasAlertMin(e.target.value)}
                      className={inputCls}
                      placeholder="2.0"
                      min="0"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label htmlFor="alert-ctr-min" className={labelCls}>{t('campaigns.ctrLowerLimit')}</label>
                    <input
                      id="alert-ctr-min"
                      type="number"
                      value={ctrAlertMin}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCtrAlertMin(e.target.value)}
                      className={inputCls}
                      placeholder="1.5"
                      min="0"
                      step="0.1"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Targeting */}
          {currentTab === 2 && (
            <div className="space-y-5" id="campaign-tab-panel-2" role="tabpanel">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="age-min" className={labelCls}>{t('campaigns.ageMin')}</label>
                  <div className="relative">
                    <select
                      id="age-min"
                      value={ageMin}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAgeMin(e.target.value)}
                      className={cn(inputCls, 'appearance-none pr-8')}
                    >
                      {getAgeOptions().map((age) => (
                        <option key={age} value={age}>{age}{t('campaigns.ageSuffix')}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <label htmlFor="age-max" className={labelCls}>{t('campaigns.ageMax')}</label>
                  <div className="relative">
                    <select
                      id="age-max"
                      value={ageMax}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAgeMax(e.target.value)}
                      className={cn(inputCls, 'appearance-none pr-8')}
                    >
                      {getAgeOptions().map((age) => (
                        <option key={age} value={age}>{age}{t('campaigns.ageSuffix')}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
              </div>

              <div>
                <span className="mb-2 block text-sm font-medium text-foreground">{t('campaigns.gender')}</span>
                <div className="flex gap-2">
                  {([
                    { value: 'male' as Gender, labelKey: 'campaigns.genderMale' },
                    { value: 'female' as Gender, labelKey: 'campaigns.genderFemale' },
                    { value: 'unspecified' as Gender, labelKey: 'campaigns.genderUnspecified' },
                  ]).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleGender(option.value)}
                      className={cn(
                        'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                        genders.includes(option.value)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/50',
                      )}
                    >
                      {t(option.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              <TagInput
                id="targeting-regions"
                label={t('campaigns.region')}
                tags={regions}
                onAdd={(tag) => setRegions((prev) => [...prev, tag])}
                onRemove={(tag) => setRegions((prev) => prev.filter((t) => t !== tag))}
                suggestions={getRegionSuggestions(t)}
                placeholder={t('campaigns.regionPlaceholder')}
              />

              <TagInput
                id="targeting-interests"
                label={t('campaigns.interests')}
                tags={interests}
                onAdd={(tag) => setInterests((prev) => [...prev, tag])}
                onRemove={(tag) => setInterests((prev) => prev.filter((t) => t !== tag))}
                suggestions={getInterestSuggestions(t)}
                placeholder={t('campaigns.interestsPlaceholder')}
              />

              <div>
                <span className="mb-2 block text-sm font-medium text-foreground">{t('campaigns.device')}</span>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: 'all' as Device, labelKey: 'campaigns.deviceAll', icon: <Globe size={14} /> },
                    { value: 'mobile' as Device, labelKey: 'campaigns.deviceMobile', icon: <Smartphone size={14} /> },
                    { value: 'desktop' as Device, labelKey: 'campaigns.deviceDesktop', icon: <Monitor size={14} /> },
                    { value: 'tablet' as Device, labelKey: 'campaigns.deviceTablet', icon: <Tablet size={14} /> },
                  ]).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleDevice(option.value)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                        devices.includes(option.value)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/50',
                      )}
                    >
                      {option.icon}
                      {t(option.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-2 block text-sm font-medium text-foreground">{t('campaigns.exclusionAudiences')}</span>
                <div className="flex flex-wrap gap-2">
                  {getExclusionAudiences(t).map((audience) => (
                    <button
                      key={audience}
                      type="button"
                      onClick={() => toggleExclusionAudience(audience)}
                      className={cn(
                        'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                        exclusionAudiences.includes(audience)
                          ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400'
                          : 'border-border text-muted-foreground hover:border-red-300/50',
                      )}
                    >
                      {audience}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Creative */}
          {currentTab === 3 && (
            <div className="space-y-5" id="campaign-tab-panel-3" role="tabpanel">
              <div>
                <span className="mb-2 block text-sm font-medium text-foreground">{t('campaigns.selectFromCreatives')}</span>
                <div className="grid grid-cols-3 gap-3">
                  {getMockExistingCreatives(t).map((creative) => {
                    const isSelected = selectedCreativeIds.includes(creative.id);
                    return (
                      <button
                        key={creative.id}
                        type="button"
                        onClick={() => toggleCreative(creative.id)}
                        className={cn(
                          'group relative rounded-lg border-2 p-2 text-left transition-all',
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/30',
                        )}
                      >
                        <div className="flex h-20 items-center justify-center rounded-md bg-muted/50">
                          <Image size={24} className="text-muted-foreground/30" />
                        </div>
                        <p className="mt-1.5 text-xs font-medium text-foreground line-clamp-1">
                          {creative.name}
                        </p>
                        {isSelected && (
                          <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                            <Check size={12} className="text-primary-foreground" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-primary" />
                    <span className="text-sm font-semibold text-foreground">{t('campaigns.aiAutoGenerate')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiAutoGenerate(!aiAutoGenerate)}
                    className={cn(
                      'relative h-6 w-11 rounded-full transition-colors',
                      aiAutoGenerate ? 'bg-primary' : 'bg-muted',
                    )}
                    role="switch"
                    aria-checked={aiAutoGenerate}
                    aria-label={t('campaigns.enableAiAutoGenerate')}
                  >
                    <span className={cn(
                      'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                      aiAutoGenerate && 'translate-x-5',
                    )} />
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('campaigns.aiAutoGenerateDesc')}
                </p>
              </div>

              <div className="rounded-lg border border-border p-4">
                <h4 className="mb-3 text-sm font-semibold text-foreground">{t('campaigns.utmParameters')}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="utm-source" className={labelCls}>utm_source</label>
                    <input
                      id="utm-source"
                      type="text"
                      value={utmSource}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUtmSource(e.target.value)}
                      className={inputCls}
                      placeholder="google"
                    />
                  </div>
                  <div>
                    <label htmlFor="utm-medium" className={labelCls}>utm_medium</label>
                    <input
                      id="utm-medium"
                      type="text"
                      value={utmMedium}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUtmMedium(e.target.value)}
                      className={inputCls}
                      placeholder="cpc"
                    />
                  </div>
                  <div>
                    <label htmlFor="utm-campaign" className={labelCls}>utm_campaign</label>
                    <input
                      id="utm-campaign"
                      type="text"
                      value={utmCampaign}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUtmCampaign(e.target.value)}
                      className={inputCls}
                      placeholder="spring_promotion"
                    />
                  </div>
                  <div>
                    <label htmlFor="utm-content" className={labelCls}>utm_content</label>
                    <input
                      id="utm-content"
                      type="text"
                      value={utmContent}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUtmContent(e.target.value)}
                      className={inputCls}
                      placeholder="banner_a"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Platforms */}
          {currentTab === 4 && (
            <div className="space-y-5" id="campaign-tab-panel-4" role="tabpanel">
              <div>
                <span className="mb-2 block text-sm font-medium text-foreground">{t('campaigns.deliveryPlatforms')}</span>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(PLATFORM_CONFIG) as [Platform, { label: string; color: string }][]).map(
                    ([key, config]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => togglePlatform(key)}
                        className={cn(
                          'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                          selectedPlatforms.includes(key)
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/50',
                        )}
                      >
                        {config.label}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {selectedPlatforms.length > 0 && (
                <div className="rounded-lg border border-border p-4">
                  <h4 className="mb-3 text-sm font-semibold text-foreground">{t('campaigns.budgetAllocationPercent')}</h4>
                  <div className="space-y-3">
                    {selectedPlatforms.map((platform) => (
                      <div key={platform} className="flex items-center gap-3">
                        <span className="w-16 text-sm font-medium text-foreground">
                          {PLATFORM_CONFIG[platform].label}
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={platformBudgetAllocation[platform]}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            handlePlatformBudgetChange(platform, Number(e.target.value))
                          }
                          className="flex-1 accent-primary"
                          aria-label={t('campaigns.ariaBudgetAllocation', { platform: PLATFORM_CONFIG[platform].label })}
                        />
                        <span className="w-12 text-right text-sm font-semibold text-foreground">
                          {platformBudgetAllocation[platform]}%
                        </span>
                      </div>
                    ))}
                    {(() => {
                      const total = selectedPlatforms.reduce(
                        (sum, p) => sum + platformBudgetAllocation[p], 0,
                      );
                      return (
                        <div className={cn(
                          'flex items-center justify-between border-t border-border pt-2 text-sm font-semibold',
                          total === 100 ? 'text-green-600' : 'text-yellow-600',
                        )}>
                          <span>{t('campaigns.total')}</span>
                          <span>{total}%</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {selectedPlatforms.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-foreground">{t('campaigns.platformSpecificSettings')}</h4>
                  <div className="space-y-2">
                    {selectedPlatforms.map((platform) => (
                      <details
                        key={platform}
                        className="rounded-lg border border-border"
                      >
                        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/30">
                          <span className={cn(
                            'inline-flex h-5 items-center rounded px-1.5 text-[10px] font-medium text-white',
                            PLATFORM_CONFIG[platform].color,
                          )}>
                            {PLATFORM_CONFIG[platform].label}
                          </span>
                          {t('campaigns.platformSpecificSettingsLabel')}
                        </summary>
                        <div className="border-t border-border px-4 py-3">
                          <p className="text-xs text-muted-foreground">
                            {t('campaigns.platformSpecificSettingsHint', { platform: PLATFORM_CONFIG[platform].label })}
                          </p>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={() => currentTab > 0 && setCurrentTab((currentTab - 1) as CampaignTab)}
            disabled={currentTab === 0}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-30"
          >
            <ChevronLeft size={14} />
            {t('common.back')}
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              {t('common.cancel')}
            </button>
            {currentTab < 4 ? (
              <button
                type="button"
                onClick={() => setCurrentTab((currentTab + 1) as CampaignTab)}
                disabled={!canAdvanceTab(currentTab)}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {t('common.next')}
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={createMutation.isPending || !name || !budgetTotal || selectedPlatforms.length === 0 || !startDate}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                {t('common.create')}
              </button>
            )}
          </div>
        </div>

        {createMutation.error && (
          <div className="border-t border-border px-6 py-3">
            <p className="text-sm text-destructive">{createMutation.error.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// -- Filter Bar --

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: CampaignStatus | 'all';
  onStatusChange: (value: CampaignStatus | 'all') => void;
  platformFilter: Set<Platform>;
  onPlatformToggle: (platform: Platform) => void;
  objectiveFilter: Objective | 'all';
  onObjectiveChange: (value: Objective | 'all') => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

function FilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  platformFilter,
  onPlatformToggle,
  objectiveFilter,
  onObjectiveChange,
  hasActiveFilters,
  onClearFilters,
}: FilterBarProps): React.ReactElement {
  const { t } = useI18n();
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
      {/* Search */}
      <div className="relative flex-1 min-w-48">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
          className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={t('campaigns.searchPlaceholder')}
          aria-label={t('campaigns.searchLabel')}
        />
      </div>

      {/* Status filter */}
      <div className="relative">
        <select
          value={statusFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onStatusChange(e.target.value as CampaignStatus | 'all')}
          className="appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label={t('campaigns.statusFilterLabel')}
        >
          <option value="all">{t('campaigns.allStatuses')}</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{t(STATUS_CONFIG[s].labelKey)}</option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      </div>

      {/* Platform multi-select */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPlatformDropdownOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          aria-label={t('campaigns.platformFilterLabel')}
          aria-expanded={platformDropdownOpen}
        >
          <span>
            {platformFilter.size === 0
              ? t('campaigns.allPlatforms')
              : t('campaigns.selectedCount', { count: platformFilter.size })}
          </span>
          <ChevronDown size={14} className={cn('transition-transform', platformDropdownOpen && 'rotate-180')} />
        </button>
        {platformDropdownOpen && (
          <div className="absolute left-0 z-50 mt-1 w-56 overflow-hidden rounded-md border border-border bg-card shadow-lg animate-slide-up">
            {ALL_PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPlatformToggle(p)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <div className={cn(
                  'flex h-4 w-4 items-center justify-center rounded border',
                  platformFilter.has(p) ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                )}>
                  {platformFilter.has(p) && <Check size={10} strokeWidth={3} />}
                </div>
                <PlatformIcon platform={dbPlatformToEnum(p)} size={14} />
                <span className="flex-1 text-left text-xs font-medium">{PLATFORM_CONFIG[p].label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Objective filter */}
      <div className="relative">
        <select
          value={objectiveFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onObjectiveChange(e.target.value as Objective | 'all')}
          className="appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label={t('campaigns.objectiveFilterLabel')}
        >
          <option value="all">{t('campaigns.allObjectives')}</option>
          {OBJECTIVE_KEYS.map((opt) => (
            <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      </div>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
        >
          <X size={14} />
          {t('campaigns.clearFilters')}
        </button>
      )}
    </div>
  );
}

// -- Bulk Action Bar --

interface BulkActionBarProps {
  selectedCount: number;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
  onDeselect: () => void;
}

function BulkActionBar({
  selectedCount,
  onPause,
  onResume,
  onDelete,
  onDeselect,
}: BulkActionBarProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 shadow-lg animate-slide-up">
        <div className="flex items-center gap-2 pr-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground tabular-nums">
            {selectedCount}
          </span>
          <span className="text-xs font-medium text-foreground">
            {t('campaigns.selectedBulkCount', { count: selectedCount })}
          </span>
        </div>
        <div className="h-5 w-px bg-border" />
        <button
          type="button"
          onClick={onPause}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-warning transition-colors hover:bg-warning/10"
        >
          <Pause size={12} />
          {t('campaigns.bulkPause')}
        </button>
        <button
          type="button"
          onClick={onResume}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-success transition-colors hover:bg-success/10"
        >
          <Play size={12} />
          {t('campaigns.bulkResume')}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <Trash2 size={12} />
          {t('campaigns.bulkDelete')}
        </button>
        <div className="h-5 w-px bg-border" />
        <button
          type="button"
          onClick={onDeselect}
          className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {t('campaigns.deselect')}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function CampaignsPage(): React.ReactElement {
  const { t } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all');
  const [platformFilter, setPlatformFilter] = useState<Set<Platform>>(new Set());
  const [objectiveFilter, setObjectiveFilter] = useState<Objective | 'all'>('all');

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // tRPC query with fallback to mock data
  const campaignsQuery = trpc.campaigns.list.useQuery(undefined, { retry: false });
  const pauseMutation = trpc.campaigns.pause.useMutation();
  const resumeMutation = trpc.campaigns.resume.useMutation();

  const campaigns: Campaign[] = campaignsQuery.error
    ? getMockCampaigns(t)
    : (campaignsQuery.data as Campaign[] | undefined) ?? getMockCampaigns(t);

  const isLoading = campaignsQuery.isLoading && !campaignsQuery.error;

  // Apply filters
  const filteredCampaigns = campaigns.filter((c) => {
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (platformFilter.size > 0 && !c.platforms.some((p) => platformFilter.has(p))) return false;
    if (objectiveFilter !== 'all' && c.objective !== objectiveFilter) return false;
    return true;
  });

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all' || platformFilter.size > 0 || objectiveFilter !== 'all';

  function handleSort(field: SortField): void {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
    const modifier = sortDirection === 'asc' ? 1 : -1;
    switch (sortField) {
      case 'name':
        return a.name.localeCompare(b.name) * modifier;
      case 'status':
        return a.status.localeCompare(b.status) * modifier;
      case 'budget':
        return (a.budget.total - b.budget.total) * modifier;
      case 'roas':
        return (a.roas - b.roas) * modifier;
      case 'updatedAt':
        return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * modifier;
      default:
        return 0;
    }
  });

  // Selection helpers
  const allVisibleSelected = sortedCampaigns.length > 0 && sortedCampaigns.every((c) => selectedIds.has(c.id));

  function toggleSelectAll(): void {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedCampaigns.map((c) => c.id)));
    }
  }

  function toggleSelect(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handlePlatformToggle(platform: Platform): void {
    setPlatformFilter((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) {
        next.delete(platform);
      } else {
        next.add(platform);
      }
      return next;
    });
  }

  function clearFilters(): void {
    setSearchQuery('');
    setStatusFilter('all');
    setPlatformFilter(new Set());
    setObjectiveFilter('all');
  }

  function formatCurrency(amount: number): string {

    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount);
  }

  function formatDate(dateStr: string): string {

    return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(dateStr));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ad Management"
        title={t('campaigns.title')}
        description={`${sortedCampaigns.length} 件 / 全 ${campaigns.length} 件`}
        actions={
          <>
            <ExportButton
              data={sortedCampaigns}
              columns={EXPORT_COLUMN_DEFS.map((col) => ({
                ...col,
                label: t(col.labelKey),
              }))}
              filename="campaigns"
            />
            <Button
              size="sm"
              leadingIcon={<Plus size={14} />}
              onClick={() => setModalOpen(true)}
            >
              {t('campaigns.create')}
            </Button>
          </>
        }
      />

      {/* Filter bar */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        platformFilter={platformFilter}
        onPlatformToggle={handlePlatformToggle}
        objectiveFilter={objectiveFilter}
        onObjectiveChange={setObjectiveFilter}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {/* Checkbox column */}
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-input text-primary accent-primary"
                    aria-label={t('campaigns.selectAll')}
                  />
                </th>
                {TABLE_COLUMNS.map((column) => (
                  <th key={column.key} className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {column.sortable ? (
                      <SortHeader
                        label={t(column.labelKey)}
                        field={column.key as SortField}
                        currentField={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                    ) : (
                      t(column.labelKey)
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : sortedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLUMNS.length + 1} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <FolderKanban size={48} className="text-muted-foreground/30" />
                      <p className="text-muted-foreground">
                        {t('campaigns.empty')}
                      </p>
                      {!hasActiveFilters && (
                        <p className="text-sm text-muted-foreground/70">
                          {t('campaigns.create')}
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sortedCampaigns.map((campaign) => (
                  <tr key={campaign.id} className={cn(
                    'border-b border-border transition-colors hover:bg-muted/30',
                    selectedIds.has(campaign.id) && 'bg-primary/5',
                  )}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(campaign.id)}
                        onChange={() => toggleSelect(campaign.id)}
                        className="h-4 w-4 rounded border-input text-primary accent-primary"
                        aria-label={t('campaigns.ariaSelectCampaign', { name: campaign.name })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setDetailCampaign(campaign)}
                        className="font-medium text-primary hover:underline"
                      >
                        {campaign.name}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={campaign.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PlatformBadges platforms={campaign.platforms} />
                    </td>
                    <td className="px-4 py-3 text-foreground">{formatCurrency(campaign.budget.total)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('font-semibold tabular-nums', campaign.roas >= 3 ? 'text-success' : campaign.roas >= 1 ? 'text-warning' : 'text-muted-foreground')}>
                        {campaign.roas > 0 ? `${campaign.roas.toFixed(1)}x` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(campaign.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        {campaign.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => pauseMutation.mutate({ id: campaign.id })}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-warning/10 hover:text-warning"
                            title={t('campaigns.hb57e4b')}
                            aria-label={t('campaigns.ariaPauseCampaign', { name: campaign.name })}
                          >
                            <Pause size={14} />
                          </button>
                        ) : campaign.status === 'paused' ? (
                          <button
                            type="button"
                            onClick={() => resumeMutation.mutate({ id: campaign.id })}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-success/10 hover:text-success"
                            title={t('campaigns.h3fade1')}
                            aria-label={t('campaigns.ariaResumeCampaign', { name: campaign.name })}
                          >
                            <Play size={14} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          title={t('campaigns.h757886')}
                          aria-label={t('campaigns.ariaEditCampaign', { name: campaign.name })}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          title={t('campaigns.hc6577c')}
                          aria-label={t('campaigns.ariaDeleteCampaign', { name: campaign.name })}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onPause={() => {
            selectedIds.forEach((id) => pauseMutation.mutate({ id }));
            setSelectedIds(new Set());
          }}
          onResume={() => {
            selectedIds.forEach((id) => resumeMutation.mutate({ id }));
            setSelectedIds(new Set());
          }}
          onDelete={() => setSelectedIds(new Set())}
          onDeselect={() => setSelectedIds(new Set())}
        />
      )}

      {/* Create campaign modal */}
      <CreateCampaignModal open={modalOpen} onClose={() => setModalOpen(false)} />

      {/* Campaign detail modal */}
      {detailCampaign && (
        <CampaignDetailModal
          campaign={detailCampaign}
          onClose={() => setDetailCampaign(null)}
        />
      )}
    </div>
  );
}
