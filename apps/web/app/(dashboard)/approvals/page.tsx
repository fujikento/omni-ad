'use client';

import { useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckSquare,
  ChevronDown,
  Clock,
  MessageSquare,
  Plus,
  Settings2,
  Shield,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

type ApprovalTab = 'pending' | 'my-requests' | 'policies';
type RequestType = 'budget_change' | 'campaign_create' | 'creative_publish' | 'rule_change';
type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
type PolicyTarget = 'campaign' | 'budget' | 'creative' | 'auto_rule';
type ApproverRole = 'owner' | 'admin' | 'manager';

interface Comment {
  id: string;
  user: string;
  text: string;
  timestamp: string;
}

interface ApprovalRequest {
  id: string;
  type: RequestType;
  title: string;
  requester: { name: string; role: string; avatar: string };
  timeAgo: string;
  reason: string;
  changes: { label: string; before: string; after: string; percentChange?: number }[];
  comments: Comment[];
  status: RequestStatus;
}

interface ApprovalPolicy {
  id: string;
  name: string;
  target: PolicyTarget;
  budgetThreshold: number;
  requiredApprovers: number;
  approverRoles: ApproverRole[];
  autoApproveLimit: number;
  enabled: boolean;
}

interface TabDef {
  id: ApprovalTab;
  label: string;
}

// ============================================================
// Constants
// ============================================================

const TABS: TabDef[] = [
  { id: 'pending', label: '承認待ち' },
  { id: 'my-requests', label: '自分のリクエスト' },
  { id: 'policies', label: '承認ポリシー' },
];

const REQUEST_TYPE_CONFIG: Record<RequestType, { label: string; className: string }> = {
  budget_change: { label: '予算変更', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  campaign_create: { label: 'キャンペーン作成', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  creative_publish: { label: 'クリエイティブ配信', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  rule_change: { label: 'ルール変更', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
};

const STATUS_CONFIG: Record<RequestStatus, { label: string; className: string; icon: React.ReactNode }> = {
  pending: {
    label: '承認待ち',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: <Clock size={12} />,
  },
  approved: {
    label: '承認済み',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: <Check size={12} />,
  },
  rejected: {
    label: '却下',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: <XCircle size={12} />,
  },
  cancelled: {
    label: '取消',
    className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    icon: <X size={12} />,
  },
};

const POLICY_TARGET_LABELS: Record<PolicyTarget, string> = {
  campaign: 'キャンペーン',
  budget: '予算配分',
  creative: 'クリエイティブ',
  auto_rule: '自動ルール',
};

const APPROVER_ROLE_LABELS: Record<ApproverRole, string> = {
  owner: 'オーナー',
  admin: '管理者',
  manager: 'マネージャー',
};

// ============================================================
// Mock Data
// ============================================================

const MOCK_PENDING: ApprovalRequest[] = [
  {
    id: 'r1',
    type: 'budget_change',
    title: 'キャンペーン「春の新生活」の予算を ¥80,000 → ¥150,000 に変更',
    requester: { name: '田中太郎', role: 'マーケター', avatar: 'T' },
    timeAgo: '3時間前',
    reason: 'コンバージョン率が好調のため、予算を増額してリーチを拡大したい',
    changes: [{ label: '月間予算', before: '¥80,000', after: '¥150,000', percentChange: 87.5 }],
    comments: [
      { id: 'c1', user: '鈴木花子', text: 'ROAS 3.5以上を維持しているので問題ないと思います', timestamp: '2時間前' },
    ],
    status: 'pending',
  },
  {
    id: 'r2',
    type: 'campaign_create',
    title: '新規キャンペーン「GWセール2026」の作成',
    requester: { name: '佐藤健一', role: 'マーケター', avatar: 'S' },
    timeAgo: '5時間前',
    reason: 'ゴールデンウィーク向けセールキャンペーンを開始したい',
    changes: [
      { label: '予算', before: '--', after: '¥300,000' },
      { label: '期間', before: '--', after: '4/29 - 5/6' },
      { label: '対象', before: '--', after: 'Google, Meta, TikTok' },
    ],
    comments: [],
    status: 'pending',
  },
  {
    id: 'r3',
    type: 'creative_publish',
    title: 'クリエイティブ「夏先取りビジュアル」の配信開始',
    requester: { name: '山田美咲', role: 'デザイナー', avatar: 'Y' },
    timeAgo: '1日前',
    reason: '夏商品の先行プロモーション用ビジュアルを承認してほしい',
    changes: [
      { label: '配信先', before: '--', after: 'Meta, TikTok' },
      { label: 'ターゲット', before: '--', after: '18-35歳 女性' },
    ],
    comments: [
      { id: 'c2', user: '田中太郎', text: '薬機法チェック済みですか？', timestamp: '18時間前' },
      { id: 'c3', user: '山田美咲', text: 'はい、法務部に確認済みです', timestamp: '16時間前' },
    ],
    status: 'pending',
  },
  {
    id: 'r4',
    type: 'rule_change',
    title: '自動入札ルール「CPA上限」のしきい値変更',
    requester: { name: '田中太郎', role: 'マーケター', avatar: 'T' },
    timeAgo: '1日前',
    reason: 'CPA上限を緩和してリーチを広げたい',
    changes: [{ label: 'CPA上限', before: '¥3,000', after: '¥5,000', percentChange: 66.7 }],
    comments: [],
    status: 'pending',
  },
  {
    id: 'r5',
    type: 'budget_change',
    title: 'キャンペーン「Meta リターゲティング」の日次上限変更',
    requester: { name: '鈴木花子', role: 'マネージャー', avatar: 'H' },
    timeAgo: '2日前',
    reason: '週末に向けて予算を増額',
    changes: [{ label: '日次上限', before: '¥10,000', after: '¥25,000', percentChange: 150 }],
    comments: [],
    status: 'pending',
  },
];

const MOCK_MY_REQUESTS: ApprovalRequest[] = [
  {
    id: 'mr1',
    type: 'budget_change',
    title: 'キャンペーン「春のプロモーション」の予算増額',
    requester: { name: '自分', role: 'マーケター', avatar: 'U' },
    timeAgo: '1日前',
    reason: '',
    changes: [{ label: '月間予算', before: '¥400,000', after: '¥500,000' }],
    comments: [{ id: 'mc1', user: '管理者', text: '承認しました。ROASに注視してください', timestamp: '12時間前' }],
    status: 'approved',
  },
  {
    id: 'mr2',
    type: 'campaign_create',
    title: '新規キャンペーン「TikTokテスト」の作成',
    requester: { name: '自分', role: 'マーケター', avatar: 'U' },
    timeAgo: '3日前',
    reason: '',
    changes: [{ label: '予算', before: '--', after: '¥100,000' }],
    comments: [{ id: 'mc2', user: '管理者', text: '却下。先にA/Bテストの結果を確認してください', timestamp: '2日前' }],
    status: 'rejected',
  },
  {
    id: 'mr3',
    type: 'budget_change',
    title: 'キャンペーン「LINE公式」の日次上限変更',
    requester: { name: '自分', role: 'マーケター', avatar: 'U' },
    timeAgo: '5時間前',
    reason: '',
    changes: [{ label: '日次上限', before: '¥30,000', after: '¥50,000' }],
    comments: [],
    status: 'pending',
  },
  {
    id: 'mr4',
    type: 'creative_publish',
    title: 'クリエイティブ「春セールバナー」の配信',
    requester: { name: '自分', role: 'マーケター', avatar: 'U' },
    timeAgo: '1週間前',
    reason: '',
    changes: [],
    comments: [],
    status: 'approved',
  },
  {
    id: 'mr5',
    type: 'rule_change',
    title: '自動予算配分ルールの変更',
    requester: { name: '自分', role: 'マーケター', avatar: 'U' },
    timeAgo: '2週間前',
    reason: '',
    changes: [],
    comments: [],
    status: 'cancelled',
  },
  {
    id: 'mr6',
    type: 'budget_change',
    title: 'Google広告の月間予算変更',
    requester: { name: '自分', role: 'マーケター', avatar: 'U' },
    timeAgo: '2週間前',
    reason: '',
    changes: [{ label: '月間予算', before: '¥200,000', after: '¥350,000' }],
    comments: [],
    status: 'approved',
  },
  {
    id: 'mr7',
    type: 'campaign_create',
    title: '新規キャンペーン「Yahoo検索」',
    requester: { name: '自分', role: 'マーケター', avatar: 'U' },
    timeAgo: '3週間前',
    reason: '',
    changes: [{ label: '予算', before: '--', after: '¥150,000' }],
    comments: [],
    status: 'approved',
  },
  {
    id: 'mr8',
    type: 'creative_publish',
    title: 'クリエイティブ「動画広告v2」の配信',
    requester: { name: '自分', role: 'マーケター', avatar: 'U' },
    timeAgo: '1ヶ月前',
    reason: '',
    changes: [],
    comments: [],
    status: 'rejected',
  },
];

const MOCK_POLICIES: ApprovalPolicy[] = [
  {
    id: 'p1',
    name: '高額予算変更ポリシー',
    target: 'budget',
    budgetThreshold: 100000,
    requiredApprovers: 2,
    approverRoles: ['owner', 'admin'],
    autoApproveLimit: 30000,
    enabled: true,
  },
  {
    id: 'p2',
    name: 'キャンペーン作成ポリシー',
    target: 'campaign',
    budgetThreshold: 50000,
    requiredApprovers: 1,
    approverRoles: ['owner', 'admin', 'manager'],
    autoApproveLimit: 50000,
    enabled: true,
  },
  {
    id: 'p3',
    name: '自動ルール変更ポリシー',
    target: 'auto_rule',
    budgetThreshold: 0,
    requiredApprovers: 1,
    approverRoles: ['owner', 'admin'],
    autoApproveLimit: 0,
    enabled: false,
  },
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

function RequestTypeBadge({ type }: { type: RequestType }): React.ReactElement {
  const config = REQUEST_TYPE_CONFIG[type];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}

function StatusBadge({ status }: { status: RequestStatus }): React.ReactElement {
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', config.className)}>
      {config.icon}
      {config.label}
    </span>
  );
}

function PendingRequestCard({
  request,
  onApprove,
  onReject,
}: {
  request: ApprovalRequest;
  onApprove: () => void;
  onReject: () => void;
}): React.ReactElement {
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <RequestTypeBadge type={request.type} />
        <span className="text-xs text-muted-foreground">{request.timeAgo}</span>
      </div>

      <h3 className="mt-2 text-sm font-semibold text-foreground">{request.title}</h3>

      {/* Requester */}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
          {request.requester.avatar}
        </div>
        <span className="text-sm text-foreground">{request.requester.name}</span>
        <span className="text-xs text-muted-foreground">{request.requester.role}</span>
      </div>

      {/* Changes */}
      {request.changes.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {request.changes.map((change) => (
            <div key={change.label} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">{change.label}:</span>
              <span className="text-foreground">{change.before}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium text-foreground">{change.after}</span>
              {change.percentChange !== undefined && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-xs font-medium',
                  change.percentChange > 50
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                )}>
                  +{change.percentChange.toFixed(1)}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reason */}
      {request.reason && (
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium">理由: </span>
          {request.reason}
        </p>
      )}

      {/* Comments */}
      {request.comments.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setCommentsExpanded(!commentsExpanded)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
          >
            <MessageSquare size={12} />
            コメント ({request.comments.length})
            <ChevronDown
              size={12}
              className={cn('transition-transform', commentsExpanded && 'rotate-180')}
            />
          </button>
          {commentsExpanded && (
            <div className="mt-2 space-y-2">
              {request.comments.map((comment) => (
                <div key={comment.id} className="rounded-md bg-muted/30 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{comment.user}</span>
                    <span className="text-xs text-muted-foreground">{comment.timestamp}</span>
                  </div>
                  <p className="mt-0.5 text-muted-foreground">{comment.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={onApprove}
          className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
        >
          <Check size={14} />
          承認
        </button>
        {showRejectInput ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              type="text"
              value={rejectReason}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRejectReason(e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="却下理由を入力..."
              autoFocus
            />
            <button
              type="button"
              onClick={() => {
                onReject();
                setShowRejectInput(false);
              }}
              className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              却下
            </button>
            <button
              type="button"
              onClick={() => setShowRejectInput(false)}
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-accent"
            >
              キャンセル
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowRejectInput(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <XCircle size={14} />
            却下
          </button>
        )}
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <MessageSquare size={14} />
          コメント
        </button>
      </div>
    </div>
  );
}

function MyRequestCard({ request }: { request: ApprovalRequest }): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <RequestTypeBadge type={request.type} />
            <StatusBadge status={request.status} />
          </div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-1.5 text-left text-sm font-medium text-foreground hover:text-primary"
          >
            {request.title}
          </button>
          <p className="mt-0.5 text-xs text-muted-foreground">{request.timeAgo}</p>
        </div>
        {request.status === 'pending' && (
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            取り消し
          </button>
        )}
      </div>

      {expanded && request.comments.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {request.comments.map((comment) => (
            <div key={comment.id} className="rounded-md bg-muted/30 px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{comment.user}</span>
                <span className="text-xs text-muted-foreground">{comment.timestamp}</span>
              </div>
              <p className="mt-0.5 text-muted-foreground">{comment.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Policy Tab
// ============================================================

function PolicyCreateModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): React.ReactElement | null {
  const [name, setName] = useState('');
  const [target, setTarget] = useState<PolicyTarget>('campaign');
  const [threshold, setThreshold] = useState('');
  const [requiredApprovers, setRequiredApprovers] = useState<number>(1);
  const [roles, setRoles] = useState<Set<ApproverRole>>(new Set());
  const [autoLimit, setAutoLimit] = useState('');

  if (!open) return null;

  function toggleRole(role: ApproverRole): void {
    setRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">ポリシー作成</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="閉じる">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {/* Policy name */}
          <div>
            <label htmlFor="policy-name" className="mb-1 block text-sm font-medium text-foreground">
              ポリシー名
            </label>
            <input
              id="policy-name"
              type="text"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="高額予算変更ポリシー"
            />
          </div>

          {/* Target */}
          <div>
            <label htmlFor="policy-target" className="mb-1 block text-sm font-medium text-foreground">
              対象
            </label>
            <div className="relative">
              <select
                id="policy-target"
                value={target}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTarget(e.target.value as PolicyTarget)}
                className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {(Object.entries(POLICY_TARGET_LABELS) as [PolicyTarget, string][]).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Threshold */}
          <div>
            <label htmlFor="policy-threshold" className="mb-1 block text-sm font-medium text-foreground">
              予算しきい値 (JPY)
            </label>
            <p className="mb-1 text-xs text-muted-foreground">この金額以上の変更に承認が必要</p>
            <input
              id="policy-threshold"
              type="number"
              value={threshold}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setThreshold(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="100000"
              min="0"
            />
          </div>

          {/* Required approvers */}
          <div>
            <span className="mb-1 block text-sm font-medium text-foreground">必要承認数</span>
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRequiredApprovers(n)}
                  className={cn(
                    'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                    requiredApprovers === n
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Approver roles */}
          <div>
            <span className="mb-2 block text-sm font-medium text-foreground">承認可能ロール</span>
            <div className="space-y-2">
              {(Object.entries(APPROVER_ROLE_LABELS) as [ApproverRole, string][]).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={roles.has(key)}
                    onChange={() => toggleRole(key)}
                    className="rounded border-input"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Auto-approve */}
          <div>
            <label htmlFor="policy-auto" className="mb-1 block text-sm font-medium text-foreground">
              自動承認上限 (JPY)
            </label>
            <p className="mb-1 text-xs text-muted-foreground">この金額以下は自動承認</p>
            <input
              id="policy-auto"
              type="number"
              value={autoLimit}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAutoLimit(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="30000"
              min="0"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              キャンセル
            </button>
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              作成
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PoliciesTab(): React.ReactElement {
  const [policies, setPolicies] = useState<ApprovalPolicy[]>(MOCK_POLICIES);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  function handleTogglePolicy(id: string): void {
    setPolicies((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">承認ポリシー</h3>
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus size={16} />
          ポリシー作成
        </button>
      </div>

      {policies.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16 text-center">
          <Shield size={40} className="mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">ポリシーがありません</p>
          <p className="mt-1 text-sm text-muted-foreground">
            承認ポリシーを作成して承認フローを管理しましょう
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">ポリシー名</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">対象</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">しきい値</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">承認数</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">承認ロール</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">自動承認上限</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">状態</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((policy) => (
                <tr key={policy.id} className="border-b border-border transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">{policy.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{POLICY_TARGET_LABELS[policy.target]}</td>
                  <td className="px-4 py-3 text-right text-foreground">{formatYen(policy.budgetThreshold)}</td>
                  <td className="px-4 py-3 text-center text-foreground">{policy.requiredApprovers}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {policy.approverRoles.map((role) => (
                        <span key={role} className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                          {APPROVER_ROLE_LABELS[role]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">{formatYen(policy.autoApproveLimit)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleTogglePolicy(policy.id)}
                      className={cn(
                        'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                        policy.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600',
                      )}
                      role="switch"
                      aria-checked={policy.enabled}
                      aria-label={policy.enabled ? '有効' : '無効'}
                    >
                      <span className={cn(
                        'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
                        policy.enabled ? 'translate-x-4' : 'translate-x-0',
                      )} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        aria-label="編集"
                      >
                        <Settings2 size={14} />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1.5 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                        aria-label="削除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PolicyCreateModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function ApprovalsPage(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<ApprovalTab>('pending');
  const [pendingRequests, setPendingRequests] = useState<ApprovalRequest[]>(MOCK_PENDING);

  const pendingCount = pendingRequests.length;

  function handleApprove(id: string): void {
    setPendingRequests((prev) => prev.filter((r) => r.id !== id));
  }

  function handleReject(id: string): void {
    setPendingRequests((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          承認管理 (稟議)
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          予算変更やキャンペーン作成の承認フローを管理します
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-6" aria-label="タブナビゲーション">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative border-b-2 pb-3 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
              )}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              {tab.label}
              {tab.id === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16 text-center">
              <CheckSquare size={40} className="mb-3 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">承認待ちのリクエストはありません</p>
              <p className="mt-1 text-sm text-muted-foreground">
                すべてのリクエストが処理されています
              </p>
            </div>
          ) : (
            pendingRequests.map((request) => (
              <PendingRequestCard
                key={request.id}
                request={request}
                onApprove={() => handleApprove(request.id)}
                onReject={() => handleReject(request.id)}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'my-requests' && (
        <div className="space-y-3">
          {MOCK_MY_REQUESTS.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16 text-center">
              <AlertCircle size={40} className="mb-3 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">リクエストはありません</p>
            </div>
          ) : (
            MOCK_MY_REQUESTS.map((request) => (
              <MyRequestCard key={request.id} request={request} />
            ))
          )}
        </div>
      )}

      {activeTab === 'policies' && <PoliciesTab />}
    </div>
  );
}
