'use client';

import { useState, useEffect, useRef } from 'react';
import {
  BarChart3,
  BrainCircuit,
  Command,
  FlaskConical,
  Gauge,
  GitFork,
  Home,
  LayoutDashboard,
  Plus,
  ScrollText,
  Search,
  Settings,
  Swords,
  Users,
  Workflow,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// -- Types --

type CommandCategory = 'navigation' | 'action' | 'campaign';

interface CommandItem {
  id: string;
  label: string;
  category: CommandCategory;
  icon: React.ReactNode;
  href?: string;
  onSelect?: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// -- Constants --

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  navigation: 'ページ移動',
  action: 'アクション',
  campaign: '最近のキャンペーン',
};

const NAVIGATION_COMMANDS: CommandItem[] = [
  { id: 'nav-home', label: 'ダッシュボード', category: 'navigation', icon: <Home size={16} />, href: '/', keywords: ['home', 'ホーム', '概要'] },
  { id: 'nav-campaigns', label: 'キャンペーン', category: 'navigation', icon: <LayoutDashboard size={16} />, href: '/campaigns', keywords: ['campaign'] },
  { id: 'nav-creatives', label: 'クリエイティブ', category: 'navigation', icon: <BrainCircuit size={16} />, href: '/creatives', keywords: ['creative', 'AI'] },
  { id: 'nav-analytics', label: '分析', category: 'navigation', icon: <BarChart3 size={16} />, href: '/analytics', keywords: ['analytics', 'chart'] },
  { id: 'nav-audiences', label: 'オーディエンス', category: 'navigation', icon: <Users size={16} />, href: '/audiences', keywords: ['audience', 'セグメント'] },
  { id: 'nav-budgets', label: '予算最適化', category: 'navigation', icon: <Gauge size={16} />, href: '/budgets', keywords: ['budget', '予算'] },
  { id: 'nav-funnels', label: 'ファネル', category: 'navigation', icon: <GitFork size={16} />, href: '/funnels', keywords: ['funnel'] },
  { id: 'nav-reports', label: 'レポート', category: 'navigation', icon: <ScrollText size={16} />, href: '/reports', keywords: ['report'] },
  { id: 'nav-abtests', label: 'A/Bテスト', category: 'navigation', icon: <FlaskConical size={16} />, href: '/ab-tests', keywords: ['ab', 'test', 'テスト'] },
  { id: 'nav-rules', label: '自動ルール', category: 'navigation', icon: <Workflow size={16} />, href: '/auto-rules', keywords: ['rule', 'automation', 'ルール'] },
  { id: 'nav-competitors', label: '競合分析', category: 'navigation', icon: <Swords size={16} />, href: '/competitors', keywords: ['competitor'] },
  { id: 'nav-settings', label: '設定', category: 'navigation', icon: <Settings size={16} />, href: '/settings', keywords: ['settings', '設定'] },
];

const ACTION_COMMANDS: CommandItem[] = [
  { id: 'act-new-campaign', label: '新規キャンペーン作成', category: 'action', icon: <Plus size={16} />, href: '/campaigns?action=create', keywords: ['new', 'create', '作成'] },
  { id: 'act-optimize', label: '最適化実行', category: 'action', icon: <Zap size={16} />, href: '/budgets?action=optimize', keywords: ['optimize', '最適化'] },
  { id: 'act-report', label: 'レポート生成', category: 'action', icon: <ScrollText size={16} />, href: '/reports?action=generate', keywords: ['generate', 'report', '生成'] },
];

const RECENT_CAMPAIGN_COMMANDS: CommandItem[] = [
  { id: 'camp-1', label: '春のプロモーション2026', category: 'campaign', icon: <LayoutDashboard size={16} />, href: '/campaigns/1' },
  { id: 'camp-2', label: 'TikTok新規獲得キャンペーン', category: 'campaign', icon: <LayoutDashboard size={16} />, href: '/campaigns/2' },
  { id: 'camp-3', label: 'ブランド認知拡大', category: 'campaign', icon: <LayoutDashboard size={16} />, href: '/campaigns/3' },
];

const ALL_COMMANDS: CommandItem[] = [
  ...NAVIGATION_COMMANDS,
  ...ACTION_COMMANDS,
  ...RECENT_CAMPAIGN_COMMANDS,
];

// -- Helpers --

function fuzzyMatch(query: string, text: string, keywords?: string[]): boolean {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  if (lowerText.includes(lowerQuery)) return true;

  if (keywords?.some((kw) => kw.toLowerCase().includes(lowerQuery))) {
    return true;
  }

  // Simple fuzzy: all characters appear in order
  let qi = 0;
  for (let ti = 0; ti < lowerText.length && qi < lowerQuery.length; ti++) {
    if (lowerText[ti] === lowerQuery[qi]) qi++;
  }
  return qi === lowerQuery.length;
}

// -- Component --

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps): React.ReactElement | null {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? ALL_COMMANDS.filter((cmd) => fuzzyMatch(query, cmd.label, cmd.keywords))
    : ALL_COMMANDS;

  const grouped = (['navigation', 'action', 'campaign'] as CommandCategory[])
    .map((cat) => ({
      category: cat,
      items: filtered.filter((cmd) => cmd.category === cat),
    }))
    .filter((group) => group.items.length > 0);

  const flatItems = grouped.flatMap((g) => g.items);

  // Reset selection when filtered results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      // Delay to allow the modal to render first
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector('[data-selected="true"]');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % flatItems.length);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length);
        break;
      }
      case 'Enter': {
        e.preventDefault();
        const item = flatItems[selectedIndex];
        if (item) selectItem(item);
        break;
      }
      case 'Escape': {
        e.preventDefault();
        onOpenChange(false);
        break;
      }
    }
  }

  function selectItem(item: CommandItem): void {
    onOpenChange(false);
    if (item.onSelect) {
      item.onSelect();
    } else if (item.href) {
      window.location.href = item.href;
    }
  }

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Escape') onOpenChange(false);
        }}
        role="button"
        tabIndex={0}
        aria-label="コマンドパレットを閉じる"
      />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        role="dialog"
        aria-label="コマンドパレット"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search size={18} className="flex-shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            placeholder="コマンドを検索..."
            aria-label="コマンド検索"
          />
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-2" role="listbox">
          {flatItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              一致する結果がありません
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.category} className="mb-2">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  {CATEGORY_LABELS[group.category]}
                </div>
                {group.items.map((item) => {
                  const currentIndex = flatIndex++;
                  const isSelected = currentIndex === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-selected={isSelected}
                      onClick={() => selectItem(item)}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                        isSelected
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground hover:bg-muted',
                      )}
                    >
                      <span className="flex-shrink-0 text-muted-foreground">{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                      {isSelected && (
                        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          Enter
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-border px-4 py-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">
              <span className="text-[9px]">&#x2191;&#x2193;</span>
            </kbd>
            <span>移動</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">Enter</kbd>
            <span>選択</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">Esc</kbd>
            <span>閉じる</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// -- Trigger Button --

export function CommandPaletteTrigger({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      aria-label="コマンドパレットを開く"
    >
      <Search size={14} />
      <span className="hidden sm:inline">検索...</span>
      <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:inline-block">
        <Command size={10} className="mr-0.5 inline" />K
      </kbd>
    </button>
  );
}
