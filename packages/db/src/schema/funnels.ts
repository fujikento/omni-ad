import { relations, sql } from 'drizzle-orm';
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';

import { campaigns } from './campaigns';
import { funnelStatusEnum } from './enums';
import { organizations, users } from './organizations';

export const funnels = pgTable('funnels', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  stages: jsonb('stages').notNull(),
  status: funnelStatusEnum('status').notNull().default('draft'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const funnelStageCampaigns = pgTable('funnel_stage_campaigns', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  funnelId: uuid('funnel_id')
    .notNull()
    .references(() => funnels.id, { onDelete: 'cascade' }),
  stageIndex: integer('stage_index').notNull(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
});

// Relations

export const funnelsRelations = relations(funnels, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [funnels.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [funnels.createdBy],
    references: [users.id],
  }),
  stageCampaigns: many(funnelStageCampaigns),
}));

export const funnelStageCampaignsRelations = relations(
  funnelStageCampaigns,
  ({ one }) => ({
    funnel: one(funnels, {
      fields: [funnelStageCampaigns.funnelId],
      references: [funnels.id],
    }),
    campaign: one(campaigns, {
      fields: [funnelStageCampaigns.campaignId],
      references: [campaigns.id],
    }),
  }),
);

// ---------------------------------------------------------------------------
// FunnelStage — typed shape for the `funnels.stages` JSONB payload.
// Each stage describes a conversion step plus optional platform/campaign
// routing metadata used by the monthly-funnel pivot service.
// ---------------------------------------------------------------------------

export interface FunnelStage {
  name: string;
  eventName: string;
  type?: string;
  platforms?: string[];
  campaignIds?: string[];
  platform?: string;
}

export const funnelStageSchema: z.ZodType<FunnelStage> = z.object({
  name: z.string().min(1),
  eventName: z.string().min(1),
  type: z.string().optional(),
  platforms: z.array(z.string()).optional(),
  campaignIds: z.array(z.string().uuid()).optional(),
  platform: z.string().optional(),
});

export const funnelStagesSchema = z.array(funnelStageSchema);
