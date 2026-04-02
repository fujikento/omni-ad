import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { organizations, users } from './organizations';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const approvalRequestTypeEnum = pgEnum('approval_request_type', [
  'campaign_create',
  'campaign_edit',
  'budget_change',
  'creative_deploy',
  'rule_change',
]);

export const approvalStatusEnum = pgEnum('approval_status', [
  'pending',
  'approved',
  'rejected',
  'cancelled',
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApprovalChangeEntry {
  field: string;
  before: unknown;
  after: unknown;
}

export interface ApprovalComment {
  userId: string;
  text: string;
  createdAt: string;
}

export interface ApprovalPolicyConditions {
  budgetThreshold?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const approvalRequests = pgTable(
  'approval_requests',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    approverIds: text('approver_ids')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    type: approvalRequestTypeEnum('type').notNull(),
    status: approvalStatusEnum('status').notNull().default('pending'),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    changes: jsonb('changes')
      .notNull()
      .$type<Record<string, ApprovalChangeEntry>>(),
    reason: text('reason'),
    approvedBy: uuid('approved_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectedBy: uuid('rejected_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    comments: jsonb('comments')
      .$type<ApprovalComment[]>()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('approval_requests_org_idx').on(table.organizationId),
    index('approval_requests_status_idx').on(
      table.organizationId,
      table.status,
    ),
    index('approval_requests_requester_idx').on(table.requesterId),
    index('approval_requests_entity_idx').on(
      table.entityType,
      table.entityId,
    ),
  ],
);

export const approvalPolicies = pgTable(
  'approval_policies',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    entityType: text('entity_type').notNull(),
    conditions: jsonb('conditions')
      .notNull()
      .$type<ApprovalPolicyConditions>(),
    requiredApprovers: integer('required_approvers').notNull().default(1),
    approverRoles: text('approver_roles')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    autoApproveBelow: numeric('auto_approve_below', {
      precision: 14,
      scale: 2,
    }),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('approval_policies_org_idx').on(table.organizationId),
    index('approval_policies_entity_type_idx').on(
      table.organizationId,
      table.entityType,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const approvalRequestsRelations = relations(
  approvalRequests,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [approvalRequests.organizationId],
      references: [organizations.id],
    }),
    requester: one(users, {
      fields: [approvalRequests.requesterId],
      references: [users.id],
      relationName: 'requester',
    }),
    approver: one(users, {
      fields: [approvalRequests.approvedBy],
      references: [users.id],
      relationName: 'approver',
    }),
    rejector: one(users, {
      fields: [approvalRequests.rejectedBy],
      references: [users.id],
      relationName: 'rejector',
    }),
  }),
);

export const approvalPoliciesRelations = relations(
  approvalPolicies,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [approvalPolicies.organizationId],
      references: [organizations.id],
    }),
  }),
);
