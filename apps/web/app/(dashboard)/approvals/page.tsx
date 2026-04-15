'use client';

import { useEffect, useState } from 'react';
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
import { EmptyState, PageHeader, Tabs } from '@omni-ad/ui';
import { cn } from '@/lib/utils';
import { showToast } from '@/lib/show-toast';
import { trpc } from '@/lib/trpc';
import { useI18n } from '@/lib/i18n';

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
  labelKey: string;
}

// ============================================================
// Constants
// ============================================================

const TAB_KEYS: TabDef[] = [
  { id: 'pending', labelKey: 'approvals.tabPending' },
  { id: 'my-requests', labelKey: 'approvals.tabMyRequests' },
  { id: 'policies', labelKey: 'approvals.tabPolicies' },
];

const REQUEST_TYPE_KEYS: Record<RequestType, { labelKey: string; className: string }> = {
  budget_change: { labelKey: 'approvals.requestBudgetChange', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  campaign_create: { labelKey: 'approvals.requestCampaignCreate', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  creative_publish: { labelKey: 'approvals.requestCreativePublish', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  rule_change: { labelKey: 'approvals.requestRuleChange', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
};

const STATUS_KEYS: Record<RequestStatus, { labelKey: string; className: string; icon: React.ReactNode }> = {
  pending: {
    labelKey: 'approvals.statusPending',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: <Clock size={12} />,
  },
  approved: {
    labelKey: 'approvals.statusApproved',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: <Check size={12} />,
  },
  rejected: {
    labelKey: 'approvals.statusRejected',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: <XCircle size={12} />,
  },
  cancelled: {
    labelKey: 'approvals.statusCancelled',
    className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    icon: <X size={12} />,
  },
};

const POLICY_TARGET_LABEL_KEYS: Record<PolicyTarget, string> = {
  campaign: 'approvals.targetCampaign',
  budget: 'approvals.targetBudget',
  creative: 'approvals.targetCreative',
  auto_rule: 'approvals.targetAutoRule',
};

const APPROVER_ROLE_LABEL_KEYS: Record<ApproverRole, string> = {
  owner: 'approvals.roleOwner',
  admin: 'approvals.roleAdmin',
  manager: 'approvals.roleManager',
};

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
  const { t } = useI18n();
  const config = REQUEST_TYPE_KEYS[type];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className)}>
      {t(config.labelKey)}
    </span>
  );
}

function StatusBadge({ status }: { status: RequestStatus }): React.ReactElement {
  const { t } = useI18n();
  const config = STATUS_KEYS[status];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', config.className)}>
      {config.icon}
      {t(config.labelKey)}
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
  const { t } = useI18n();
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');

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
          <span className="font-medium">{t('approvals.reason')}: </span>
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
            {t('approvals.comments', { count: request.comments.length })}
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
          className="inline-flex items-center gap-1.5 rounded-md bg-success px-4 py-2 text-sm font-medium text-success-foreground transition-colors hover:bg-success/90"
        >
          <Check size={14} />
          {t('approvals.approve')}
        </button>
        {showRejectInput ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              type="text"
              value={rejectReason}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRejectReason(e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={t('approvals.rejectPlaceholder')}
              autoFocus
            />
            <button
              type="button"
              onClick={() => {
                onReject();
                setShowRejectInput(false);
              }}
              className="rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
            >
              {t('approvals.reject')}
            </button>
            <button
              type="button"
              onClick={() => setShowRejectInput(false)}
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-accent"
            >
              {t('common.cancel')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowRejectInput(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <XCircle size={14} />
            {t('approvals.reject')}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowCommentInput((prev) => !prev)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <MessageSquare size={14} />
          {t('approvals.comment')}
        </button>
      </div>

      {/* Inline comment input */}
      {showCommentInput && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCommentText(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={t('approvals.commentPlaceholder')}
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              if (commentText.trim()) {
                showToast(t('approvals.commentPosted'));
                setCommentText('');
                setShowCommentInput(false);
              }
            }}
            disabled={!commentText.trim()}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {t('approvals.send')}
          </button>
        </div>
      )}
    </div>
  );
}

function MyRequestCard({ request, onCancel }: { request: ApprovalRequest; onCancel?: (id: string) => void }): React.ReactElement {
  const { t } = useI18n();
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
            onClick={() => {
              if (window.confirm(t('approvals.cancelConfirm'))) {
                onCancel?.(request.id);
                showToast(t('approvals.cancelSuccess'));
              }
            }}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {t('approvals.cancelRequest')}
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
  const { t } = useI18n();
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
          <h2 className="text-lg font-semibold text-foreground">{t('approvals.policyCreate')}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {/* Policy name */}
          <div>
            <label htmlFor="policy-name" className="mb-1 block text-sm font-medium text-foreground">
              {t('approvals.policyName')}
            </label>
            <input
              id="policy-name"
              type="text"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={t('approvals.policyNamePlaceholder')}
            />
          </div>

          {/* Target */}
          <div>
            <label htmlFor="policy-target" className="mb-1 block text-sm font-medium text-foreground">
              {t('approvals.policyTarget')}
            </label>
            <div className="relative">
              <select
                id="policy-target"
                value={target}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTarget(e.target.value as PolicyTarget)}
                className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {(Object.entries(POLICY_TARGET_LABEL_KEYS) as [PolicyTarget, string][]).map(([key, labelKey]) => (
                  <option key={key} value={key}>{t(labelKey)}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Threshold */}
          <div>
            <label htmlFor="policy-threshold" className="mb-1 block text-sm font-medium text-foreground">
              {t('approvals.policyThreshold')}
            </label>
            <p className="mb-1 text-xs text-muted-foreground">{t('approvals.policyThresholdHint')}</p>
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
            <span className="mb-1 block text-sm font-medium text-foreground">{t('approvals.policyRequiredApprovers')}</span>
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
            <span className="mb-2 block text-sm font-medium text-foreground">{t('approvals.policyApproverRoles')}</span>
            <div className="space-y-2">
              {(Object.entries(APPROVER_ROLE_LABEL_KEYS) as [ApproverRole, string][]).map(([key, labelKey]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={roles.has(key)}
                    onChange={() => toggleRole(key)}
                    className="rounded border-input"
                  />
                  {t(labelKey)}
                </label>
              ))}
            </div>
          </div>

          {/* Auto-approve */}
          <div>
            <label htmlFor="policy-auto" className="mb-1 block text-sm font-medium text-foreground">
              {t('approvals.policyAutoApprove')}
            </label>
            <p className="mb-1 text-xs text-muted-foreground">{t('approvals.policyAutoApproveHint')}</p>
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
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t('common.create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PoliciesTab(): React.ReactElement {
  const { t } = useI18n();
  const policiesQuery = trpc.approvals.policies.list.useQuery(undefined, { retry: false });
  const [policies, setPolicies] = useState<ApprovalPolicy[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    if (policiesQuery.data) {
      setPolicies((policiesQuery.data as unknown as ApprovalPolicy[] | undefined) ?? []);
    }
  }, [policiesQuery.data]);

  function handleTogglePolicy(id: string): void {
    setPolicies((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{t('approvals.policyTitle')}</h3>
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus size={16} />
          {t('approvals.policyCreate')}
        </button>
      </div>

      {policies.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16 text-center">
          <Shield size={40} className="mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">{t('approvals.policyEmpty')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('approvals.policyEmptyHint')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('approvals.policyTableName')}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('approvals.policyTableTarget')}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('approvals.policyTableThreshold')}</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t('approvals.policyTableApproverCount')}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('approvals.policyTableApproverRoles')}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('approvals.policyTableAutoApprove')}</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t('approvals.policyTableState')}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('approvals.policyTableActions')}</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((policy) => (
                <tr key={policy.id} className="border-b border-border transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">{policy.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t(POLICY_TARGET_LABEL_KEYS[policy.target])}</td>
                  <td className="px-4 py-3 text-right text-foreground">{formatYen(policy.budgetThreshold)}</td>
                  <td className="px-4 py-3 text-center text-foreground">{policy.requiredApprovers}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {policy.approverRoles.map((role) => (
                        <span key={role} className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                          {t(APPROVER_ROLE_LABEL_KEYS[role])}
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
                      aria-label={policy.enabled ? t('autoRules.enabled') : t('autoRules.disabled')}
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
                        aria-label={t('approvals.h757886')}
                      >
                        <Settings2 size={14} />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1.5 text-destructive/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label={t('approvals.hc6577c')}
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
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<ApprovalTab>('pending');

  const pendingQuery = trpc.approvals.requests.list.useQuery(
    { status: 'pending' },
    { retry: false },
  );
  const myRequestsQuery = trpc.approvals.requests.list.useQuery(
    {},
    { retry: false },
  );

  const [pendingRequests, setPendingRequests] = useState<ApprovalRequest[]>([]);
  const [myRequests, setMyRequests] = useState<ApprovalRequest[]>([]);

  useEffect(() => {
    if (pendingQuery.data) {
      setPendingRequests((pendingQuery.data as unknown as ApprovalRequest[] | undefined) ?? []);
    }
  }, [pendingQuery.data]);

  useEffect(() => {
    if (myRequestsQuery.data) {
      setMyRequests((myRequestsQuery.data as unknown as ApprovalRequest[] | undefined) ?? []);
    }
  }, [myRequestsQuery.data]);

  const pendingCount = pendingRequests.length;

  function handleApprove(id: string): void {
    setPendingRequests((prev) => prev.filter((r) => r.id !== id));
  }

  function handleReject(id: string): void {
    setPendingRequests((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Management"
        title={t('approvals.title')}
        description={t('approvals.description')}
      />

      <Tabs
        value={activeTab}
        onValueChange={(k) => setActiveTab(k as ApprovalTab)}
        items={TAB_KEYS.map((tab) => ({
          key: tab.id,
          label: t(tab.labelKey),
          badge:
            tab.id === 'pending' && pendingCount > 0 ? (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                {pendingCount}
              </span>
            ) : null,
        }))}
      />

      {/* Tab Content */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingRequests.length === 0 ? (
            <EmptyState
              icon={<CheckSquare size={18} />}
              title={t('approvals.emptyPending')}
              description={t('approvals.emptyPendingDetail')}
              className="py-16"
            />
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
          {myRequests.length === 0 ? (
            <EmptyState
              icon={<AlertCircle size={18} />}
              title={t('approvals.emptyMyRequests')}
              className="py-16"
            />
          ) : (
            myRequests.map((request) => (
              <MyRequestCard
                key={request.id}
                request={request}
                onCancel={(id) => setMyRequests((prev) => prev.map((r) =>
                  r.id === id ? { ...r, status: 'cancelled' as RequestStatus } : r
                ))}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'policies' && <PoliciesTab />}
    </div>
  );
}
