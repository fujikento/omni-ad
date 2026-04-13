import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  addComment,
  approveRequest,
  ApprovalNotFoundError,
  cancelRequest,
  checkPolicyRequired,
  createApprovalRequest,
  createPolicy,
  getApprovalRequest,
  InvalidApprovalStateError,
  listApprovalRequests,
  listPolicies,
  PolicyNotFoundError,
  rejectRequest,
  UnauthorizedApproverError,
  updatePolicy,
} from '../../services/approval.service.js';
import type { ApprovalChangeEntry, ApprovalPolicyConditions } from '@omni-ad/db/schema';
import { organizationProcedure, rbacProcedure, router } from '../trpc.js';

// ---------------------------------------------------------------------------
// Input Schemas
// ---------------------------------------------------------------------------

const ApprovalRequestType = z.enum([
  'campaign_create',
  'campaign_edit',
  'budget_change',
  'creative_deploy',
  'rule_change',
]);

const ApprovalStatus = z.enum([
  'pending',
  'approved',
  'rejected',
  'cancelled',
]);

const ChangeEntrySchema = z.object({
  field: z.string(),
  before: z.unknown(),
  after: z.unknown(),
});

const CreateApprovalRequestInput = z.object({
  type: ApprovalRequestType,
  entityType: z.string().min(1),
  entityId: z.string().uuid().optional(),
  changes: z.record(z.string(), ChangeEntrySchema),
  reason: z.string().optional(),
  approverIds: z.array(z.string().uuid()).min(1),
});

const ListRequestsInput = z.object({
  status: ApprovalStatus.optional(),
  requesterId: z.string().uuid().optional(),
});

const PolicyConditionsSchema = z
  .object({
    budgetThreshold: z.number().optional(),
  })
  .passthrough();

const CreatePolicyInput = z.object({
  name: z.string().min(1).max(200),
  entityType: z.string().min(1),
  conditions: PolicyConditionsSchema,
  requiredApprovers: z.number().int().min(1).max(10).default(1),
  approverRoles: z.array(z.string().min(1)),
  autoApproveBelow: z.string().optional(),
});

const UpdatePolicyInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  entityType: z.string().min(1).optional(),
  conditions: PolicyConditionsSchema.optional(),
  requiredApprovers: z.number().int().min(1).max(10).optional(),
  approverRoles: z.array(z.string().min(1)).optional(),
  autoApproveBelow: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

const CheckPolicyInput = z.object({
  entityType: z.string().min(1),
  changes: z.record(z.string(), ChangeEntrySchema),
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

function handleServiceError(error: unknown): never {
  if (error instanceof ApprovalNotFoundError) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: error.message,
    });
  }
  if (error instanceof InvalidApprovalStateError) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: error.message,
    });
  }
  if (error instanceof UnauthorizedApproverError) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: error.message,
    });
  }
  if (error instanceof PolicyNotFoundError) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: error.message,
    });
  }
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    cause: error,
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const approvalsRouter = router({
  requests: router({
    list: organizationProcedure
      .input(ListRequestsInput.default({}))
      .query(async ({ ctx, input }) => {
        try {
          return await listApprovalRequests(ctx.organizationId, {
            status: input.status,
            requesterId: input.requesterId,
          });
        } catch (error) {
          handleServiceError(error);
        }
      }),

    get: organizationProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        try {
          const request = await getApprovalRequest(
            input.id,
            ctx.organizationId,
          );
          if (!request) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: `Approval request not found: ${input.id}`,
            });
          }
          return request;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          handleServiceError(error);
        }
      }),

    create: organizationProcedure
      .input(CreateApprovalRequestInput)
      .mutation(async ({ ctx, input }) => {
        try {
          return await createApprovalRequest(
            ctx.organizationId,
            ctx.userId,
            {
              type: input.type,
              entityType: input.entityType,
              entityId: input.entityId,
              changes: input.changes as Record<string, ApprovalChangeEntry>,
              reason: input.reason,
              approverIds: input.approverIds,
            },
          );
        } catch (error) {
          handleServiceError(error);
        }
      }),

    approve: organizationProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await approveRequest(
            input.id,
            ctx.userId,
            ctx.organizationId,
          );
        } catch (error) {
          handleServiceError(error);
        }
      }),

    reject: organizationProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          reason: z.string().min(1).max(1000),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await rejectRequest(
            input.id,
            ctx.userId,
            ctx.organizationId,
            input.reason,
          );
        } catch (error) {
          handleServiceError(error);
        }
      }),

    cancel: organizationProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await cancelRequest(
            input.id,
            ctx.userId,
            ctx.organizationId,
          );
        } catch (error) {
          handleServiceError(error);
        }
      }),

    comment: organizationProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          text: z.string().min(1).max(2000),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await addComment(
            input.id,
            ctx.userId,
            input.text,
            ctx.organizationId,
          );
        } catch (error) {
          handleServiceError(error);
        }
      }),
  }),

  policies: router({
    list: organizationProcedure.query(async ({ ctx }) => {
      try {
        return await listPolicies(ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

    create: rbacProcedure("org:manage")
      .input(CreatePolicyInput)
      .mutation(async ({ ctx, input }) => {
        try {
          return await createPolicy(ctx.organizationId, {
            name: input.name,
            entityType: input.entityType,
            conditions: input.conditions as ApprovalPolicyConditions,
            requiredApprovers: input.requiredApprovers,
            approverRoles: input.approverRoles,
            autoApproveBelow: input.autoApproveBelow,
          });
        } catch (error) {
          handleServiceError(error);
        }
      }),

    update: rbacProcedure("org:manage")
      .input(UpdatePolicyInput)
      .mutation(async ({ ctx, input }) => {
        try {
          const { id, ...fields } = input;
          return await updatePolicy(id, ctx.organizationId, {
            ...fields,
            conditions: fields.conditions as ApprovalPolicyConditions | undefined,
          });
        } catch (error) {
          handleServiceError(error);
        }
      }),
  }),

  checkPolicy: organizationProcedure
    .input(CheckPolicyInput)
    .query(async ({ ctx, input }) => {
      try {
        return await checkPolicyRequired(
          ctx.organizationId,
          input.entityType,
          input.changes as Record<string, ApprovalChangeEntry>,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),
});
