/**
 * Identity Graph Service (WeChat Ecosystem Model)
 *
 * Cross-platform identity resolution and unified segmentation.
 * Enables deterministic matching via hashed identifiers and
 * probabilistic matching via platform ID correlation.
 */

import { db } from '@omni-ad/db';
import {
  identityGraph,
  unifiedSegments,
  type PlatformIds,
  type SegmentCriteria,
  type PlatformDistribution,
  type SyncStatus,
} from '@omni-ad/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type IdentitySelect = typeof identityGraph.$inferSelect;
type SegmentSelect = typeof unifiedSegments.$inferSelect;

export interface CustomerImportRecord {
  email?: string;
  phone?: string;
  platformIds?: PlatformIds;
  audiences?: string[];
}

export interface ImportResult {
  imported: number;
  merged: number;
  errors: number;
}

export interface IdentityProfile {
  id: string;
  emailHash: string | null;
  phoneHash: string | null;
  platformIds: PlatformIds;
  audiences: string[];
  touchpointCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface PlatformOverlap {
  platformA: string;
  platformB: string;
  overlapCount: number;
  platformATotal: number;
  platformBTotal: number;
  overlapPercentage: number;
}

export interface CreateSegmentInput {
  name: string;
  description?: string;
  criteria: SegmentCriteria;
}

export interface PaginatedSegments {
  segments: SegmentSelect[];
  total: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashValue(value: string): string {
  return createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

function computeCompositeHash(
  emailHash: string | null,
  phoneHash: string | null,
): string | null {
  if (emailHash && phoneHash) {
    return hashValue(`${emailHash}:${phoneHash}`);
  }
  return emailHash ?? phoneHash;
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

export async function importCustomers(
  organizationId: string,
  records: CustomerImportRecord[],
): Promise<ImportResult> {
  let imported = 0;
  let merged = 0;
  let errors = 0;

  for (const record of records) {
    try {
      const emailHash = record.email ? hashValue(record.email) : null;
      const phoneHash = record.phone ? hashValue(record.phone) : null;
      const compositeHash = computeCompositeHash(emailHash, phoneHash);

      if (!compositeHash) {
        errors++;
        continue;
      }

      // Try to find existing identity by composite hash
      const existing = await db.query.identityGraph.findFirst({
        where: and(
          eq(identityGraph.organizationId, organizationId),
          eq(identityGraph.compositeHash, compositeHash),
        ),
      });

      if (existing) {
        // Merge platform IDs and audiences
        const mergedPlatformIds: PlatformIds = {
          ...(existing.platformIds as PlatformIds),
          ...record.platformIds,
        };

        const existingAudiences = new Set(existing.audiences ?? []);
        for (const audience of record.audiences ?? []) {
          existingAudiences.add(audience);
        }

        await db
          .update(identityGraph)
          .set({
            platformIds: mergedPlatformIds,
            audiences: Array.from(existingAudiences),
            touchpointCount: existing.touchpointCount + 1,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(identityGraph.id, existing.id));

        merged++;
      } else {
        await db.insert(identityGraph).values({
          organizationId,
          emailHash,
          phoneHash,
          compositeHash,
          platformIds: record.platformIds ?? {},
          audiences: record.audiences ?? [],
          touchpointCount: 1,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
        });

        imported++;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      process.stderr.write(
        `[identity-graph] Import error: ${message}\n`,
      );
      errors++;
    }
  }

  return { imported, merged, errors };
}

export async function resolveIdentity(
  organizationId: string,
  identifier: { email?: string; phone?: string; platformId?: { platform: string; id: string } },
): Promise<IdentitySelect | null> {
  if (identifier.email) {
    const emailHash = hashValue(identifier.email);
    const found = await db.query.identityGraph.findFirst({
      where: and(
        eq(identityGraph.organizationId, organizationId),
        eq(identityGraph.emailHash, emailHash),
      ),
    });
    return found ?? null;
  }

  if (identifier.phone) {
    const phoneHash = hashValue(identifier.phone);
    const found = await db.query.identityGraph.findFirst({
      where: and(
        eq(identityGraph.organizationId, organizationId),
        eq(identityGraph.phoneHash, phoneHash),
      ),
    });
    return found ?? null;
  }

  if (identifier.platformId) {
    // Search via JSONB query for platform-specific ID. Both platform and id
    // are bound as parameters; do NOT use sql.raw which would interpolate
    // user input into the query string.
    const { platform, id } = identifier.platformId;
    const result = await db
      .select()
      .from(identityGraph)
      .where(
        and(
          eq(identityGraph.organizationId, organizationId),
          sql`${identityGraph.platformIds} ->> ${platform} = ${id}`,
        ),
      )
      .limit(1);

    return result[0] ?? null;
  }

  return null;
}

export async function getProfile(
  identityId: string,
  organizationId: string,
): Promise<IdentityProfile> {
  const identity = await db.query.identityGraph.findFirst({
    where: and(
      eq(identityGraph.id, identityId),
      eq(identityGraph.organizationId, organizationId),
    ),
  });

  if (!identity) {
    throw new IdentityNotFoundError(identityId);
  }

  return {
    id: identity.id,
    emailHash: identity.emailHash,
    phoneHash: identity.phoneHash,
    platformIds: identity.platformIds as PlatformIds,
    audiences: identity.audiences ?? [],
    touchpointCount: identity.touchpointCount,
    firstSeenAt: identity.firstSeenAt,
    lastSeenAt: identity.lastSeenAt,
  };
}

export async function createSegment(
  organizationId: string,
  input: CreateSegmentInput,
): Promise<SegmentSelect> {
  // Count matching identities
  const identityCount = await countMatchingIdentities(
    organizationId,
    input.criteria,
  );

  // Compute platform distribution
  const platformDist = await computePlatformDistribution(
    organizationId,
    input.criteria,
  );

  const [segment] = await db
    .insert(unifiedSegments)
    .values({
      organizationId,
      name: input.name,
      description: input.description ?? null,
      criteria: input.criteria,
      identityCount,
      platformDistribution: platformDist,
      syncStatus: {} as SyncStatus,
    })
    .returning();

  if (!segment) {
    throw new SegmentCreationError('Failed to create segment');
  }

  return segment;
}

export async function listSegments(
  organizationId: string,
  limit = 50,
  offset = 0,
): Promise<PaginatedSegments> {
  const [segments, countResult] = await Promise.all([
    db.query.unifiedSegments.findMany({
      where: eq(unifiedSegments.organizationId, organizationId),
      orderBy: [desc(unifiedSegments.createdAt)],
      limit,
      offset,
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(unifiedSegments)
      .where(eq(unifiedSegments.organizationId, organizationId)),
  ]);

  return {
    segments,
    total: countResult[0]?.count ?? 0,
  };
}

export async function getSegment(
  segmentId: string,
  organizationId: string,
): Promise<SegmentSelect | null> {
  const segment = await db.query.unifiedSegments.findFirst({
    where: and(
      eq(unifiedSegments.id, segmentId),
      eq(unifiedSegments.organizationId, organizationId),
    ),
  });
  return segment ?? null;
}

export interface OverlapMatrixResult {
  platforms: string[];
  /**
   * overlap[from][to] = % of identities on `from` that also exist on `to`.
   * Self-overlap (same platform) is not populated.
   */
  matrix: Record<string, Record<string, number>>;
  perPlatformTotals: Record<string, number>;
}

export interface SaturationSummary {
  totalIdentities: number;
  /** Histogram: onePlatform = users present on exactly 1, twoPlatforms = exactly 2, etc */
  distribution: Record<number, number>;
  /**
   * Users on 3+ platforms. These are the highest-risk "over-served"
   * audience — the same person sees your ad on multiple platforms,
   * potentially wasting spend on repeat exposure.
   */
  overServedCount: number;
  /**
   * Proportion of total identities that are on 3+ platforms. Used as
   * a single-number health signal.
   */
  overServedPercent: number;
}

/**
 * Compute pairwise overlap for all combinations of the given platforms.
 * Used by the orchestrator's audience-aware shift dampening and by the
 * identity-graph UI heatmap.
 */
export async function getOverlapMatrix(
  organizationId: string,
  platforms: readonly string[],
): Promise<OverlapMatrixResult> {
  const unique = Array.from(new Set(platforms));
  const matrix: Record<string, Record<string, number>> = {};
  const perPlatformTotals: Record<string, number> = {};

  for (let i = 0; i < unique.length; i++) {
    for (let j = 0; j < unique.length; j++) {
      if (i === j) continue;
      const a = unique[i]!;
      const b = unique[j]!;
      try {
        const overlap = await getOverlap(organizationId, a, b);
        if (!matrix[a]) matrix[a] = {};
        matrix[a]![b] = overlap.overlapPercentage;
        perPlatformTotals[a] = overlap.platformATotal;
        perPlatformTotals[b] = overlap.platformBTotal;
      } catch {
        // No identities for one or both platforms — skip silently.
      }
    }
  }

  return { platforms: unique, matrix, perPlatformTotals };
}

/**
 * Compute cross-platform saturation summary. Counts how many identities
 * exist on N platforms simultaneously (histogram 1, 2, 3+). Users on
 * 3+ platforms are flagged as "over-served" — a useful wasted-spend
 * signal since the same customer is paying to be reached multiple times.
 */
export async function getSaturationSummary(
  organizationId: string,
): Promise<SaturationSummary> {
  // Count jsonb keys via cardinality(array(...)). This is stable across
  // PG versions since 9.4 and avoids relying on optional extensions.
  const platformCountExpr = sql<number>`coalesce(array_length(array(select jsonb_object_keys(${identityGraph.platformIds})), 1), 0)`;

  const rows = await db
    .select({
      platformCount: platformCountExpr,
      count: sql<number>`count(*)::int`,
    })
    .from(identityGraph)
    .where(eq(identityGraph.organizationId, organizationId))
    .groupBy(platformCountExpr);

  const distribution: Record<number, number> = {};
  let total = 0;
  let overServed = 0;
  for (const r of rows) {
    const n = Number(r.platformCount) || 0;
    const c = Number(r.count) || 0;
    distribution[n] = c;
    total += c;
    if (n >= 3) overServed += c;
  }

  const overServedPercent =
    total > 0 ? Math.round((overServed / total) * 10_000) / 100 : 0;

  return {
    totalIdentities: total,
    distribution,
    overServedCount: overServed,
    overServedPercent,
  };
}

export async function getOverlap(
  organizationId: string,
  platformA: string,
  platformB: string,
): Promise<PlatformOverlap> {
  // Count identities present on platform A
  const platformAResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(identityGraph)
    .where(
      and(
        eq(identityGraph.organizationId, organizationId),
        sql`${identityGraph.platformIds} ? ${platformA}`,
      ),
    );

  // Count identities present on platform B
  const platformBResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(identityGraph)
    .where(
      and(
        eq(identityGraph.organizationId, organizationId),
        sql`${identityGraph.platformIds} ? ${platformB}`,
      ),
    );

  // Count identities present on both platforms
  const overlapResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(identityGraph)
    .where(
      and(
        eq(identityGraph.organizationId, organizationId),
        sql`${identityGraph.platformIds} ? ${platformA}`,
        sql`${identityGraph.platformIds} ? ${platformB}`,
      ),
    );

  const platformATotal = platformAResult[0]?.count ?? 0;
  const platformBTotal = platformBResult[0]?.count ?? 0;
  const overlapCount = overlapResult[0]?.count ?? 0;

  const maxTotal = Math.max(platformATotal, platformBTotal, 1);
  const overlapPercentage = (overlapCount / maxTotal) * 100;

  return {
    platformA,
    platformB,
    overlapCount,
    platformATotal,
    platformBTotal,
    overlapPercentage: Math.round(overlapPercentage * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

async function countMatchingIdentities(
  organizationId: string,
  criteria: SegmentCriteria,
): Promise<number> {
  const conditions = [eq(identityGraph.organizationId, organizationId)];

  if (criteria.minTouchpoints) {
    conditions.push(
      sql`${identityGraph.touchpointCount} >= ${criteria.minTouchpoints}`,
    );
  }

  if (criteria.platforms && criteria.platforms.length > 0) {
    for (const platform of criteria.platforms) {
      conditions.push(sql`${identityGraph.platformIds} ? ${platform}`);
    }
  }

  if (criteria.firstSeenAfter) {
    conditions.push(
      sql`${identityGraph.firstSeenAt} >= ${criteria.firstSeenAfter}`,
    );
  }

  if (criteria.lastSeenAfter) {
    conditions.push(
      sql`${identityGraph.lastSeenAt} >= ${criteria.lastSeenAfter}`,
    );
  }

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(identityGraph)
    .where(and(...conditions));

  return result[0]?.count ?? 0;
}

async function computePlatformDistribution(
  organizationId: string,
  criteria: SegmentCriteria,
): Promise<PlatformDistribution> {
  const platforms = ['meta', 'google', 'tiktok', 'x', 'line_yahoo', 'amazon', 'microsoft'];
  const distribution: PlatformDistribution = {};

  for (const platform of platforms) {
    const conditions = [
      eq(identityGraph.organizationId, organizationId),
      sql`${identityGraph.platformIds} ? ${platform}`,
    ];

    if (criteria.minTouchpoints) {
      conditions.push(
        sql`${identityGraph.touchpointCount} >= ${criteria.minTouchpoints}`,
      );
    }

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(identityGraph)
      .where(and(...conditions));

    const count = result[0]?.count ?? 0;
    if (count > 0) {
      distribution[platform] = count;
    }
  }

  return distribution;
}

// ---------------------------------------------------------------------------
// Custom Errors
// ---------------------------------------------------------------------------

export class IdentityNotFoundError extends Error {
  constructor(identityId: string) {
    super(`Identity not found: ${identityId}`);
    this.name = 'IdentityNotFoundError';
  }
}

export class SegmentCreationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SegmentCreationError';
  }
}
