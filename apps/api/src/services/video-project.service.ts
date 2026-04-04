/**
 * Video Project Service
 *
 * Manages the Script-to-Video pipeline lifecycle.
 */

import { db } from '@omni-ad/db';
import { videoProjects, type VideoScriptJson } from '@omni-ad/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VideoProjectSelect = typeof videoProjects.$inferSelect;
type VideoProjectStatus = VideoProjectSelect['status'];

export interface CreateVideoProjectInput {
  productName: string;
  productDescription: string;
  targetAudience: string;
  campaignGoal: string;
  platform: VideoProjectSelect['platform'];
  duration: number;
  language: 'ja' | 'en';
  keigoLevel: 'casual' | 'polite' | 'formal';
}

export interface PaginatedVideoProjects {
  projects: VideoProjectSelect[];
  total: number;
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

export async function createVideoProject(
  organizationId: string,
  input: CreateVideoProjectInput,
): Promise<VideoProjectSelect> {
  const [project] = await db
    .insert(videoProjects)
    .values({
      organizationId,
      platform: input.platform,
      duration: input.duration,
      status: 'generating_script',
    })
    .returning();

  if (!project) {
    throw new VideoProjectCreationError('Failed to create video project');
  }

  return project;
}

export async function getVideoProject(
  projectId: string,
  organizationId: string,
): Promise<VideoProjectSelect> {
  const project = await db.query.videoProjects.findFirst({
    where: and(
      eq(videoProjects.id, projectId),
      eq(videoProjects.organizationId, organizationId),
    ),
  });

  if (!project) {
    throw new VideoProjectNotFoundError(projectId);
  }

  return project;
}

export async function getScript(
  projectId: string,
  organizationId: string,
): Promise<VideoScriptJson | null> {
  const project = await getVideoProject(projectId, organizationId);
  return project.script ?? null;
}

export async function updateProjectScript(
  projectId: string,
  organizationId: string,
  script: VideoScriptJson,
): Promise<VideoProjectSelect> {
  await getVideoProject(projectId, organizationId);

  const [updated] = await db
    .update(videoProjects)
    .set({
      script,
      status: 'generating_scenes',
      updatedAt: new Date(),
    })
    .where(eq(videoProjects.id, projectId))
    .returning();

  if (!updated) {
    throw new VideoProjectNotFoundError(projectId);
  }

  return updated;
}

export async function updateProjectStatus(
  projectId: string,
  organizationId: string,
  status: VideoProjectStatus,
): Promise<VideoProjectSelect> {
  await getVideoProject(projectId, organizationId);

  const [updated] = await db
    .update(videoProjects)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(videoProjects.id, projectId))
    .returning();

  if (!updated) {
    throw new VideoProjectNotFoundError(projectId);
  }

  return updated;
}

export async function listVideoProjects(
  organizationId: string,
  limit = 50,
  offset = 0,
): Promise<PaginatedVideoProjects> {
  const [projects, countResult] = await Promise.all([
    db.query.videoProjects.findMany({
      where: eq(videoProjects.organizationId, organizationId),
      orderBy: [desc(videoProjects.createdAt)],
      limit,
      offset,
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(videoProjects)
      .where(eq(videoProjects.organizationId, organizationId)),
  ]);

  return {
    projects,
    total: countResult[0]?.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Custom Errors
// ---------------------------------------------------------------------------

export class VideoProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Video project not found: ${projectId}`);
    this.name = 'VideoProjectNotFoundError';
  }
}

export class VideoProjectCreationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VideoProjectCreationError';
  }
}
