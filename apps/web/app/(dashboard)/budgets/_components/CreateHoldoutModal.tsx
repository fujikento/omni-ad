'use client';

import { memo, useMemo, useState } from 'react';
import { AlertCircle, FlaskConical, Loader2, X } from 'lucide-react';
import { Button } from '@omni-ad/ui';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { showToast } from '@/lib/show-toast';

type Campaign = {
  id: string;
  name: string;
  status: string;
};

type Assignment = 'unassigned' | 'test' | 'control';

interface CreateHoldoutModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const ASSIGNMENT_STYLES: Record<Assignment, string> = {
  unassigned: 'bg-muted text-muted-foreground',
  test: 'bg-info/15 text-info',
  control: 'bg-warning/15 text-warning',
};

const ASSIGNMENT_LABEL: Record<Assignment, string> = {
  unassigned: '未割当',
  test: 'Test (予算変動)',
  control: 'Control (保持)',
};

export const CreateHoldoutModal = memo(function CreateHoldoutModal({
  open,
  onClose,
  onCreated,
}: CreateHoldoutModalProps): React.ReactElement | null {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assignments, setAssignments] = useState<Record<string, Assignment>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);

  const campaignsQuery = trpc.campaigns.list.useQuery(undefined, {
    enabled: open,
    retry: false,
  });
  const utils = trpc.useUtils();

  const createMutation = trpc.holdout.create.useMutation({
    onSuccess: () => {
      showToast('Holdout group を作成しました');
      void utils.holdout.list.invalidate();
      onCreated?.();
      reset();
      onClose();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  function reset(): void {
    setName('');
    setDescription('');
    setAssignments({});
    setError(null);
  }

  function toggleAssignment(campaignId: string): void {
    setAssignments((prev) => {
      const current = prev[campaignId] ?? 'unassigned';
      const next: Assignment =
        current === 'unassigned'
          ? 'test'
          : current === 'test'
            ? 'control'
            : 'unassigned';
      return { ...prev, [campaignId]: next };
    });
  }

  const campaigns = (campaignsQuery.data as Campaign[] | undefined) ?? [];

  const { testIds, controlIds, canSubmit } = useMemo(() => {
    const tIds: string[] = [];
    const cIds: string[] = [];
    for (const [id, assignment] of Object.entries(assignments)) {
      if (assignment === 'test') tIds.push(id);
      else if (assignment === 'control') cIds.push(id);
    }
    return {
      testIds: tIds,
      controlIds: cIds,
      canSubmit:
        name.trim().length > 0 && tIds.length >= 1 && cIds.length >= 1,
    };
  }, [assignments, name]);

  function handleSubmit(): void {
    if (!canSubmit) return;
    setError(null);
    createMutation.mutate({
      name: name.trim(),
      ...(description.trim() && { description: description.trim() }),
      testCampaignIds: testIds,
      controlCampaignIds: controlIds,
    });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Create holdout group"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <FlaskConical size={18} className="text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              Holdout 実験を作成
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="閉じる"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              実験名 <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="例: Q2 予算再配分 lift 測定"
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              説明
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="実験の目的・仮説"
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                キャンペーン割当{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  (クリックで Test / Control / 未割当を切替)
                </span>
              </label>
              <div className="flex gap-2 text-xs">
                <span
                  className={cn(
                    'rounded px-2 py-0.5 font-mono',
                    ASSIGNMENT_STYLES.test,
                  )}
                >
                  test: {testIds.length}
                </span>
                <span
                  className={cn(
                    'rounded px-2 py-0.5 font-mono',
                    ASSIGNMENT_STYLES.control,
                  )}
                >
                  control: {controlIds.length}
                </span>
              </div>
            </div>

            {campaignsQuery.isLoading ? (
              <div className="flex items-center justify-center rounded-md border border-border bg-muted/30 py-8">
                <Loader2
                  size={14}
                  className="mr-2 animate-spin text-muted-foreground"
                />
                <span className="text-sm text-muted-foreground">読み込み中...</span>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  キャンペーンが存在しません。先にキャンペーンを作成してください。
                </p>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                <ul className="divide-y divide-border">
                  {campaigns.map((c) => {
                    const assignment = assignments[c.id] ?? 'unassigned';
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => toggleAssignment(c.id)}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-foreground">
                              {c.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {c.status}
                            </div>
                          </div>
                          <span
                            className={cn(
                              'flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
                              ASSIGNMENT_STYLES[assignment],
                            )}
                          >
                            {ASSIGNMENT_LABEL[assignment]}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">
            Test キャンペーンは orchestrator の予算 shift 対象、Control は保持されます。
            両グループ最低 1 件ずつ、重複は不可。
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-md border border-border px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            キャンセル
          </button>
          <Button
            type="button"
            disabled={!canSubmit || createMutation.isPending}
            onClick={handleSubmit}
          >
            {createMutation.isPending ? (
              <Loader2 size={14} className="mr-2 animate-spin" />
            ) : null}
            作成
          </Button>
        </div>
      </div>
    </div>
  );
});
