'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Workflow } from 'lucide-react';
import { Button, EmptyState, PageHeader } from '@omni-ad/ui';
import { trpc } from '@/lib/trpc';
import { useI18n } from '@/lib/i18n';
import type { AutoRule, RuleExecution } from './_types';
import { RuleCard } from './_components/RuleCard';
import { ExecutionHistorySection } from './_components/ExecutionHistorySection';
import { CreateRuleModal } from './_components/CreateRuleModal';

export default function AutoRulesPage(): React.ReactElement {
  const { t } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [rules, setRules] = useState<AutoRule[]>([]);
  const [evaluating, setEvaluating] = useState(false);

  const rulesQuery = trpc.rules.list.useQuery(undefined, { retry: false });
  const executionsQuery = trpc.rules.executions.useQuery({}, { retry: false });

  useEffect(() => {
    const data = rulesQuery.data as AutoRule[] | undefined;
    if (data) setRules(data);
  }, [rulesQuery.data]);

  const executions: RuleExecution[] =
    (executionsQuery.data as RuleExecution[] | undefined) ?? [];

  const evaluateMutation = trpc.rules.evaluate.useMutation({
    onSettled: () => setEvaluating(false),
  });

  const handleToggle = useCallback((id: string, enabled: boolean): void => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled } : r)),
    );
  }, []);

  const handleEdit = useCallback((id: string): void => {
    setEditingRuleId(id);
    setModalOpen(true);
  }, []);

  const handleDuplicate = useCallback((id: string): void => {
    setRules((prev) => {
      const source = prev.find((r) => r.id === id);
      if (!source) return prev;
      const newRule: AutoRule = {
        ...source,
        id: `r${Date.now()}`,
        name: `${source.name} ${t('autoRules.copyLabel')}`,
        triggerCount: 0,
        lastTriggered: null,
      };
      return [...prev, newRule];
    });
  }, [t]);

  const handleDelete = useCallback((id: string): void => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const handleEvaluateAll = useCallback((): void => {
    setEvaluating(true);
    evaluateMutation.mutate();
    // Fallback: reset loading after timeout if tRPC call fails
    setTimeout(() => setEvaluating(false), 3000);
  }, [evaluateMutation]);

  const closeModal = useCallback((): void => {
    setModalOpen(false);
    setEditingRuleId(null);
  }, []);

  const editingRule = useMemo(
    () => (editingRuleId ? rules.find((r) => r.id === editingRuleId) ?? null : null),
    [editingRuleId, rules],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Ops"
        title={t('autoRules.title')}
        description={t('autoRules.description')}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleEvaluateAll}
              loading={evaluating}
              leadingIcon={!evaluating ? <RefreshCw size={14} /> : undefined}
            >
              {t('autoRules.evaluateAll')}
            </Button>
            <Button
              size="sm"
              leadingIcon={<Plus size={14} />}
              onClick={() => { setEditingRuleId(null); setModalOpen(true); }}
            >
              {t('autoRules.createRule')}
            </Button>
          </>
        }
      />

      {rules.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Workflow size={18} />}
          title={t('autoRules.empty')}
          description={t('autoRules.emptyHint')}
          className="py-16"
        />
      )}

      <ExecutionHistorySection executions={executions} />

      <CreateRuleModal
        open={modalOpen}
        onClose={closeModal}
        editingRule={editingRule}
      />
    </div>
  );
}
