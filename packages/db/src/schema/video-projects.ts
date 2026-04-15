import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { platformEnum } from './enums';
import { creatives } from './creatives';
import { organizations } from './organizations';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const videoProjectStatusEnum = pgEnum('video_project_status', [
  'draft',
  'generating_script',
  'generating_scenes',
  'generating_voiceover',
  'assembling',
  'review',
  'approved',
  'deployed',
]);

// ---------------------------------------------------------------------------
// JSONB types
// ---------------------------------------------------------------------------

export interface VideoScriptJson {
  title: string;
  duration: number;
  scenes: Array<{
    order: number;
    duration: number;
    description: string;
    textOverlay: string | null;
    transition: 'cut' | 'fade' | 'slide' | 'zoom';
    cameraMovement: 'static' | 'pan' | 'zoom-in' | 'zoom-out';
    visualStyle: 'product-focus' | 'lifestyle' | 'testimonial' | 'text-heavy';
  }>;
  voiceover: { text: string; language: string; tone: string };
  music: { mood: string; tempo: string };
  callToAction: { text: string; timing: number };
}

export interface SceneAssetsJson {
  scenes: Array<{
    sceneOrder: number;
    imageUrl: string;
    videoUrl: string;
    duration: number;
  }>;
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export const videoProjects = pgTable('video_projects', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  creativeId: uuid('creative_id').references(() => creatives.id, {
    onDelete: 'set null',
  }),
  script: jsonb('script').$type<VideoScriptJson>(),
  scenes: jsonb('scenes').$type<SceneAssetsJson>(),
  voiceoverUrl: text('voiceover_url'),
  musicTrack: text('music_track'),
  finalVideoUrl: text('final_video_url'),
  status: videoProjectStatusEnum('status').notNull().default('draft'),
  generationCostCents: integer('generation_cost_cents'),
  platform: platformEnum('platform'),
  duration: integer('duration').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}, (table) => ({
  orgCreatedAtIdx: index('video_projects_org_created_at_idx').on(table.organizationId, table.createdAt),
}));

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const videoProjectsRelations = relations(
  videoProjects,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [videoProjects.organizationId],
      references: [organizations.id],
    }),
    creative: one(creatives, {
      fields: [videoProjects.creativeId],
      references: [creatives.id],
    }),
  }),
);
