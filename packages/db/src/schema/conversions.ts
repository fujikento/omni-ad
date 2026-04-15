import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { campaigns } from './campaigns';
import { platformEnum } from './enums';
import { organizations } from './organizations';

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const conversionEvents = pgTable(
  'conversion_events',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    eventName: text('event_name').notNull(),
    eventValue: numeric('event_value', { precision: 14, scale: 2 }),
    currency: text('currency').notNull().default('JPY'),
    sourceUrl: text('source_url'),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    hashedEmail: text('hashed_email'),
    hashedPhone: text('hashed_phone'),
    externalClickId: text('external_click_id'),
    platform: platformEnum('platform'),
    campaignId: uuid('campaign_id').references(() => campaigns.id, {
      onDelete: 'set null',
    }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('conversion_events_org_idx').on(table.organizationId),
    index('conversion_events_event_name_idx').on(
      table.organizationId,
      table.eventName,
    ),
    index('conversion_events_campaign_idx').on(table.campaignId),
    index('conversion_events_created_at_idx').on(table.createdAt),
    index('conversion_events_platform_idx').on(
      table.organizationId,
      table.platform,
    ),
    index('conversion_events_click_id_idx').on(table.externalClickId),
  ],
);

export const conversionEndpoints = pgTable(
  'conversion_endpoints',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    pixelId: text('pixel_id').notNull().unique(),
    secretKey: text('secret_key').notNull(),
    allowedDomains: text('allowed_domains')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    eventTypes: text('event_types')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    platformMappings: jsonb('platform_mappings').$type<PlatformMappings>(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('conversion_endpoints_org_idx').on(table.organizationId),
    index('conversion_endpoints_pixel_idx').on(table.pixelId),
  ],
);

// ---------------------------------------------------------------------------
// Platform Mapping Types
// ---------------------------------------------------------------------------

export interface MetaPlatformMapping {
  pixelId: string;
  accessToken: string;
}

export interface GooglePlatformMapping {
  conversionId: string;
  label: string;
}

export interface TikTokPlatformMapping {
  pixelCode: string;
  accessToken: string;
}

export interface LineYahooPlatformMapping {
  tagId: string;
  accessToken: string;
  /**
   * Event name fired into `conversion_events.event_name` when a
   * LINE widget click is observed in a delivered ad.
   */
  cv1EventName?: string;
  /**
   * Event name for actual friend-add / account registration on the
   * LINE side (typically from the official-account webhook).
   */
  cv2EventName?: string;
  /**
   * Event name for the final conversion on the landing page — a form
   * submission, purchase, or any custom pixel-fired event.
   */
  cv3EventName?: string;
}

/**
 * Defaults applied when a LINE/Yahoo platform mapping omits the
 * per-stage event names. Matches the canonical Japanese LINE-ads
 * reporting convention (CV① / CV② / CV③).
 */
export const DEFAULT_LINE_STAGE_MAPPING = {
  cv1EventName: 'LINE_CLICK',
  cv2EventName: 'LINE_REGISTER',
  cv3EventName: 'FORM_SUBMIT',
} as const;

export interface PlatformMappings {
  meta?: MetaPlatformMapping;
  google?: GooglePlatformMapping;
  tiktok?: TikTokPlatformMapping;
  line_yahoo?: LineYahooPlatformMapping;
}

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const conversionEventsRelations = relations(
  conversionEvents,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [conversionEvents.organizationId],
      references: [organizations.id],
    }),
    campaign: one(campaigns, {
      fields: [conversionEvents.campaignId],
      references: [campaigns.id],
    }),
  }),
);

export const conversionEndpointsRelations = relations(
  conversionEndpoints,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [conversionEndpoints.organizationId],
      references: [organizations.id],
    }),
  }),
);
