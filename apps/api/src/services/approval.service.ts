/**
 * Approval Workflow Service (稟議フロー)
 *
 * Manages approval requests and policies for campaign changes,
 * budget modifications, and other organizational actions requiring sign-off.
 */

import { db } from '@omni-ad/db';
import {
  approvalRequests,
  approvalPolicies,
  campaigns,
} from '@omni-ad/db/schema';
import type {
  ApprovalChangeEntry,
  ApprovalComment,
  ApprovalPolicyConditions,
} from '@omni-ad/db/schema';
import { createNotification } from './notification.service.js';
import { and, desc, eq, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ApprovalRequestSelect = typeof approvalRequests.$inferSelect;
type ApprovalRequestInsert = typeof approvalRequests.$inferInsert;
type ApprovalPolicySelect = typeof approvalPolicies.$inferSelect;
type ApprovalPolicyInsert = typeof approvalPolicies.$inferInsert;
type ApprovalRequestType = ApprovalRequestInsert['type'];
type ApprovalStatus = NonNullable<ApprovalRequestInsert['status']>;

interface CreateApprovalRequestInput {
  type: ApprovalRequestType;
  entityType: string;
  entityId?: string;
  changes: Record<string, ApprovalChangeEntry>;
  reason?: string;
  approverIds: string[];
}

interface ListApprovalRequestsOptions {
  status?: ApprovalStatus;
  requesterId?: string;
}

interface CreatePolicyInput {
  name: string;
  entityType: string;
  conditions: ApprovalPolicyConditions;
  requiredApprovers?: number;
  approverRoles: string[];
  autoApproveBelow?: string;
}

interface UpdatePolicyInput {
  name?: string;
  entityType?: string;
  conditions?: ApprovalPolicyConditions;
  requiredApprovers?: number;
  approverRoles?: string[];
  autoApproveBelow?: string | null;
  active?: boolean;
}

export interface PolicyCheckResult {
  required: boolean;
  matchingPolicies: ApprovalPolicySelect[];
  requiredApprovers: number;
  suggestedApproverRoles: string[];
}

// ---------------------------------------------------------------------------
// Approval Request CRUD
// ---------------------------------------------------------------------------

export async function createApprovalRequest(
  organizationId: string,
  requesterId: string,
  input: CreateApprovalRequestInput,
): Promise<ApprovalRequestSelect> {
  // Check if auto-approval applies
  const policyCheck = await checkPolicyRequired(
    organizationId,
    input.entityType,
    input.changes,
  );

  // If no policy requires approval, auto-approve
  if (!policyCheck.required) {
    const values: ApprovalRequestInsert = {
      organizationId,
      requesterId,
      approverIds: input.approverIds,
      type: input.type,
      status: 'approved',
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      changes: input.changes,
      reason: input.reason ?? null,
      approvedBy: requesterId,
      approvedAt: new Date(),
    };

    const [inserted] = await db
      .insert(approvalRequests)
      .values(values)
      .returning();

    if (!inserted) {
      throw new Error('Failed to create approval request');
    }

    // Execute the change immediately
    await executeApprovedChange(inserted).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      process.stdout.write(
        `[approval] Failed to auto-execute change: ${message}\n`,
      );
    });

    return inserted;
  }

  // Create pending request
  const values: ApprovalRequestInsert = {
    organizationId,
    requesterId,
    approverIds: input.approverIds,
    type: input.type,
    status: 'pending',
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    changes: input.changes,
    reason: input.reason ?? null,
  };

  const [inserted] = await db
    .insert(approvalRequests)
    .values(values)
    .returning();

  if (!inserted) {
    throw new Error('Failed to create approval request');
  }

  // Notify all approvers
  await notifyApprovers(inserted).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Unknown error';
    process.stdout.write(
      `[approval] Failed to notify approvers: ${message}\n`,
    );
  });

  return inserted;
}

export async function listApprovalRequests(
  organizationId: string,
  options: ListApprovalRequestsOptions = {},
): Promise<ApprovalRequestSelect[]> {
  const conditions = [
    eq(approvalRequests.organizationId, organizationId),
  ];

  if (options.status) {
    conditions.push(eq(approvalRequests.status, options.status));
  }

  if (options.requesterId) {
    conditions.push(eq(approvalRequests.requesterId, options.requesterId));
  }

  return db.query.approvalRequests.findMany({
    where: and(...conditions),
    orderBy: [desc(approvalRequests.createdAt)],
  });
}

export async function getApprovalRequest(
  requestId: string,
  organizationId: string,
): Promise<ApprovalRequestSelect | undefined> {
  return db.query.approvalRequests.findFirst({
    where: and(
      eq(approvalRequests.id, requestId),
      eq(approvalRequests.organizationId, organizationId),
    ),
  });
}

export async function approveRequest(
  requestId: string,
  approverId: string,
  organizationId: string,
): Promise<ApprovalRequestSelect> {
  const request = await getApprovalRequest(requestId, organizationId);

  if (!request) {
    throw new ApprovalNotFoundError(requestId);
  }

  if (request.status !== 'pending') {
    throw new InvalidApprovalStateError(
      `Cannot approve request with status "${request.status}"`,
    );
  }

  // Verify the approver is in the approver list
  if (!request.approverIds.includes(approverId)) {
    throw new UnauthorizedApproverError(approverId, requestId);
  }

  const [updated] = await db
    .update(approvalRequests)
    .set({
      status: 'approved',
      approvedBy: approverId,
      approvedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(approvalRequests.id, requestId),
        eq(approvalRequests.organizationId, organizationId),
      ),
    )
    .returning();

  if (!updated) {
    throw new ApprovalNotFoundError(requestId);
  }

  // Execute the approved change
  await executeApprovedChange(updated).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Unknown error';
    process.stdout.write(
      `[approval] Failed to execute approved change: ${message}\n`,
    );
  });

  // Notify requester of approval
  await createNotification({
    organizationId,
    userId: updated.requesterId,
    type: 'success',
    title: '稟議承認',
    message: `${formatRequestType(updated.type)}の稟議が承認されました`,
    actionUrl: `/approvals/${updated.id}`,
    source: 'approval-service',
  }).catch(() => {
    // Notification failure should not block the approval flow
  });

  return updated;
}

export async function rejectRequest(
  requestId: string,
  rejecterId: string,
  organizationId: string,
  reason: string,
): Promise<ApprovalRequestSelect> {
  const request = await getApprovalRequest(requestId, organizationId);

  if (!request) {
    throw new ApprovalNotFoundError(requestId);
  }

  if (request.status !== 'pending') {
    throw new InvalidApprovalStateError(
      `Cannot reject request with status "${request.status}"`,
    );
  }

  if (!request.approverIds.includes(rejecterId)) {
    throw new UnauthorizedApproverError(rejecterId, requestId);
  }

  const [updated] = await db
    .update(approvalRequests)
    .set({
      status: 'rejected',
      rejectedBy: rejecterId,
      rejectedAt: sql`now()`,
      rejectionReason: reason,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(approvalRequests.id, requestId),
        eq(approvalRequests.organizationId, organizationId),
      ),
    )
    .returning();

  if (!updated) {
    throw new ApprovalNotFoundError(requestId);
  }

  // Notify requester of rejection
  await createNotification({
    organizationId,
    userId: updated.requesterId,
    type: 'warning',
    title: '稟議却下',
    message: `${formatRequestType(updated.type)}の稟議が却下されました: ${reason}`,
    actionUrl: `/approvals/${updated.id}`,
    source: 'approval-service',
  }).catch(() => {
    // Notification failure should not block the rejection flow
  });

  return updated;
}

export async function cancelRequest(
  requestId: string,
  requesterId: string,
  organizationId: string,
): Promise<ApprovalRequestSelect> {
  const request = await getApprovalRequest(requestId, organizationId);

  if (!request) {
    throw new ApprovalNotFoundError(requestId);
  }

  if (request.requesterId !== requesterId) {
    throw new InvalidApprovalStateError(
      'Only the requester can cancel a request',
    );
  }

  if (request.status !== 'pending') {
    throw new InvalidApprovalStateError(
      `Cannot cancel request with status "${request.status}"`,
    );
  }

  const [updated] = await db
    .update(approvalRequests)
    .set({
      status: 'cancelled',
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(approvalRequests.id, requestId),
        eq(approvalRequests.organizationId, organizationId),
      ),
    )
    .returning();

  if (!updated) {
    throw new ApprovalNotFoundError(requestId);
  }

  return updated;
}

export async function addComment(
  requestId: string,
  userId: string,
  text: string,
  organizationId: string,
): Promise<ApprovalRequestSelect> {
  const request = await getApprovalRequest(requestId, organizationId);

  if (!request) {
    throw new ApprovalNotFoundError(requestId);
  }

  const existingComments: ApprovalComment[] =
    (request.comments as ApprovalComment[] | null) ?? [];

  const newComment: ApprovalComment = {
    userId,
    text,
    createdAt: new Date().toISOString(),
  };

  const updatedComments = [...existingComments, newComment];

  const [updated] = await db
    .update(approvalRequests)
    .set({
      comments: updatedComments,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(approvalRequests.id, requestId),
        eq(approvalRequests.organizationId, organizationId),
      ),
    )
    .returning();

  if (!updated) {
    throw new ApprovalNotFoundError(requestId);
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Policy checking
// ---------------------------------------------------------------------------

export async function checkPolicyRequired(
  organizationId: string,
  entityType: string,
  changes: Record<string, ApprovalChangeEntry>,
): Promise<PolicyCheckResult> {
  const policies = await db.query.approvalPolicies.findMany({
    where: and(
      eq(approvalPolicies.organizationId, organizationId),
      eq(approvalPolicies.entityType, entityType),
      eq(approvalPolicies.active, true),
    ),
  });

  if (policies.length === 0) {
    return {
      required: false,
      matchingPolicies: [],
      requiredApprovers: 0,
      suggestedApproverRoles: [],
    };
  }

  const matchingPolicies: ApprovalPolicySelect[] = [];

  for (const policy of policies) {
    if (doesPolicyMatch(policy, changes)) {
      matchingPolicies.push(policy);
    }
  }

  if (matchingPolicies.length === 0) {
    return {
      required: false,
      matchingPolicies: [],
      requiredApprovers: 0,
      suggestedApproverRoles: [],
    };
  }

  // Collect the highest required approvers and all roles
  const requiredApprovers = Math.max(
    ...matchingPolicies.map((p) => p.requiredApprovers),
  );

  const suggestedApproverRoles = [
    ...new Set(matchingPolicies.flatMap((p) => p.approverRoles)),
  ];

  return {
    required: true,
    matchingPolicies,
    requiredApprovers,
    suggestedApproverRoles,
  };
}

function doesPolicyMatch(
  policy: ApprovalPolicySelect,
  changes: Record<string, ApprovalChangeEntry>,
): boolean {
  const conditions = policy.conditions as ApprovalPolicyConditions;

  // Budget threshold check
  if (conditions.budgetThreshold !== undefined) {
    const budgetChange = changes['totalBudget'] ?? changes['dailyBudget'];
    if (budgetChange) {
      const afterValue = Number(budgetChange.after);

      // Auto-approve if below the threshold
      if (
        policy.autoApproveBelow !== null &&
        policy.autoApproveBelow !== undefined &&
        afterValue < Number(policy.autoApproveBelow)
      ) {
        return false;
      }

      if (afterValue >= conditions.budgetThreshold) {
        return true;
      }
    }
  }

  // If no specific conditions matched but the policy exists for this
  // entity type, it applies as a catch-all
  if (Object.keys(conditions).length === 0) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Policy CRUD
// ---------------------------------------------------------------------------

export async function listPolicies(
  organizationId: string,
): Promise<ApprovalPolicySelect[]> {
  return db.query.approvalPolicies.findMany({
    where: eq(approvalPolicies.organizationId, organizationId),
    orderBy: [desc(approvalPolicies.createdAt)],
  });
}

export async function createPolicy(
  organizationId: string,
  input: CreatePolicyInput,
): Promise<ApprovalPolicySelect> {
  const values: ApprovalPolicyInsert = {
    organizationId,
    name: input.name,
    entityType: input.entityType,
    conditions: input.conditions,
    requiredApprovers: input.requiredApprovers ?? 1,
    approverRoles: input.approverRoles,
    autoApproveBelow: input.autoApproveBelow ?? null,
  };

  const [inserted] = await db
    .insert(approvalPolicies)
    .values(values)
    .returning();

  if (!inserted) {
    throw new Error('Failed to create approval policy');
  }

  return inserted;
}

export async function updatePolicy(
  policyId: string,
  organizationId: string,
  input: UpdatePolicyInput,
): Promise<ApprovalPolicySelect> {
  const updateSet: Record<string, unknown> = {
    updatedAt: sql`now()`,
  };

  if (input.name !== undefined) updateSet['name'] = input.name;
  if (input.entityType !== undefined)
    updateSet['entityType'] = input.entityType;
  if (input.conditions !== undefined)
    updateSet['conditions'] = input.conditions;
  if (input.requiredApprovers !== undefined)
    updateSet['requiredApprovers'] = input.requiredApprovers;
  if (input.approverRoles !== undefined)
    updateSet['approverRoles'] = input.approverRoles;
  if (input.autoApproveBelow !== undefined)
    updateSet['autoApproveBelow'] = input.autoApproveBelow;
  if (input.active !== undefined) updateSet['active'] = input.active;

  const [updated] = await db
    .update(approvalPolicies)
    .set(updateSet)
    .where(
      and(
        eq(approvalPolicies.id, policyId),
        eq(approvalPolicies.organizationId, organizationId),
      ),
    )
    .returning();

  if (!updated) {
    throw new PolicyNotFoundError(policyId);
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Change execution
// ---------------------------------------------------------------------------

export async function executeApprovedChange(
  request: ApprovalRequestSelect,
): Promise<void> {
  switch (request.type) {
    case 'campaign_create':
      await executeCampaignCreate(request);
      break;
    case 'campaign_edit':
      await executeCampaignEdit(request);
      break;
    case 'budget_change':
      await executeBudgetChange(request);
      break;
    case 'creative_deploy':
    case 'rule_change':
      // These are handled by their respective services
      // The approval just gates the action; the caller re-invokes after approval
      break;
  }
}

async function executeCampaignCreate(
  request: ApprovalRequestSelect,
): Promise<void> {
  // The changes contain the full campaign creation payload
  // For campaign_create, entityId may be null (created after approval)
  const changes = request.changes as Record<string, ApprovalChangeEntry>;
  const name = changes['name']?.after;
  const objective = changes['objective']?.after;
  const startDate = changes['startDate']?.after;
  const totalBudget = changes['totalBudget']?.after;
  const dailyBudget = changes['dailyBudget']?.after;

  if (!name || !objective || !startDate || !totalBudget || !dailyBudget) {
    process.stdout.write(
      `[approval] Incomplete campaign_create changes for request ${request.id}\n`,
    );
    return;
  }

  // Campaign creation is delegated back to the caller
  // This is a placeholder for direct execution if needed
  process.stdout.write(
    `[approval] campaign_create approved for request ${request.id}\n`,
  );
}

async function executeCampaignEdit(
  request: ApprovalRequestSelect,
): Promise<void> {
  if (!request.entityId) {
    process.stdout.write(
      `[approval] Missing entityId for campaign_edit request ${request.id}\n`,
    );
    return;
  }

  const changes = request.changes as Record<string, ApprovalChangeEntry>;
  const updateSet: Record<string, unknown> = {
    updatedAt: sql`now()`,
  };

  for (const [field, change] of Object.entries(changes)) {
    updateSet[field] = change.after;
  }

  await db
    .update(campaigns)
    .set(updateSet)
    .where(
      and(
        eq(campaigns.id, request.entityId),
        eq(campaigns.organizationId, request.organizationId),
      ),
    );
}

async function executeBudgetChange(
  request: ApprovalRequestSelect,
): Promise<void> {
  if (!request.entityId) {
    process.stdout.write(
      `[approval] Missing entityId for budget_change request ${request.id}\n`,
    );
    return;
  }

  const changes = request.changes as Record<string, ApprovalChangeEntry>;
  const updateSet: Record<string, unknown> = {
    updatedAt: sql`now()`,
  };

  if (changes['totalBudget']) {
    updateSet['totalBudget'] = changes['totalBudget'].after;
  }
  if (changes['dailyBudget']) {
    updateSet['dailyBudget'] = changes['dailyBudget'].after;
  }

  await db
    .update(campaigns)
    .set(updateSet)
    .where(
      and(
        eq(campaigns.id, request.entityId),
        eq(campaigns.organizationId, request.organizationId),
      ),
    );
}

// ---------------------------------------------------------------------------
// Notification helpers
// ---------------------------------------------------------------------------

async function notifyApprovers(
  request: ApprovalRequestSelect,
): Promise<void> {
  const notifyPromises = request.approverIds.map((approverId) =>
    createNotification({
      organizationId: request.organizationId,
      userId: approverId,
      type: 'alert',
      title: '稟議申請',
      message: `${formatRequestType(request.type)}の稟議が提出されました。承認をお願いします。`,
      actionUrl: `/approvals/${request.id}`,
      source: 'approval-service',
      metadata: {
        approvalRequestId: request.id,
        requestType: request.type,
        entityType: request.entityType,
        entityId: request.entityId,
      },
    }),
  );

  await Promise.all(notifyPromises);
}

function formatRequestType(type: string): string {
  const labels: Record<string, string> = {
    campaign_create: 'キャンペーン作成',
    campaign_edit: 'キャンペーン編集',
    budget_change: '予算変更',
    creative_deploy: 'クリエイティブ配信',
    rule_change: 'ルール変更',
  };
  return labels[type] ?? type;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ApprovalNotFoundError extends Error {
  constructor(requestId: string) {
    super(`Approval request not found: ${requestId}`);
    this.name = 'ApprovalNotFoundError';
  }
}

export class InvalidApprovalStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidApprovalStateError';
  }
}

export class UnauthorizedApproverError extends Error {
  constructor(userId: string, requestId: string) {
    super(
      `User ${userId} is not authorized to approve request ${requestId}`,
    );
    this.name = 'UnauthorizedApproverError';
  }
}

export class PolicyNotFoundError extends Error {
  constructor(policyId: string) {
    super(`Approval policy not found: ${policyId}`);
    this.name = 'PolicyNotFoundError';
  }
}
