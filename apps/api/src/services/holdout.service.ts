/**
 * Holdout Group Service.
 *
 * Managed experiments for the unified spend orchestrator: treatment
 * campaigns receive budget shifts, control campaigns are excluded.
 * computeHoldoutLift compares their ROAS over a time window to produce
 * a causal lift estimate (randomised-assignment, not observational).
 */

import { db } from '@omni-ad/db';
import {
  campaigns,
  holdoutGroups,
  metricsHourly,
} from '@omni-ad/db/schema';
import { orchestratorSafeDivide } from '@omni-ad/ai-engine';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';

export interface HoldoutGroupSelect {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  testCampaignIds: string[];
  controlCampaignIds: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateHoldoutInput {
  name: string;
  description?: string;
  testCampaignIds: string[];
  controlCampaignIds: string[];
}

export async function createHoldoutGroup(
  organizationId: string,
  input: CreateHoldoutInput,
): Promise<HoldoutGroupSelect> {
  // Validate that all referenced campaigns belong to the org (tenant leak
  // prevention — critical domain). The orchestrator uses these IDs to
  // SKIP shifts, so a bogus ID would silently break the holdout.
  const allIds = [
    ...input.testCampaignIds,
    ...input.controlCampaignIds,
  ];
  if (allIds.length > 0) {
    const owned = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.organizationId, organizationId),
          inArray(campaigns.id, allIds),
        ),
      );
    const ownedSet = new Set(owned.map((c) => c.id));
    const foreign = allIds.filter((id) => !ownedSet.has(id));
    if (foreign.length > 0) {
      throw new Error(
        `Campaign ids not owned by organization: ${foreign.join(', ')}`,
      );
    }
  }

  const testSet = new Set(input.testCampaignIds);
  const overlap = input.controlCampaignIds.filter((id) => testSet.has(id));
  if (overlap.length > 0) {
    throw new Error(
      `Campaigns present in both test and control: ${overlap.join(', ')}`,
    );
  }

  const [row] = await db
    .insert(holdoutGroups)
    .values({
      organizationId,
      name: input.name,
      description: input.description ?? null,
      testCampaignIds: input.testCampaignIds,
      controlCampaignIds: input.controlCampaignIds,
      active: true,
    })
    .returning();

  if (!row) throw new Error('Failed to create holdout group');
  return normalize(row);
}

export async function listHoldoutGroups(
  organizationId: string,
): Promise<HoldoutGroupSelect[]> {
  const rows = await db.query.holdoutGroups.findMany({
    where: eq(holdoutGroups.organizationId, organizationId),
    orderBy: [desc(holdoutGroups.createdAt)],
  });
  return rows.map(normalize);
}

export async function getHoldoutGroup(
  groupId: string,
  organizationId: string,
): Promise<HoldoutGroupSelect | null> {
  const row = await db.query.holdoutGroups.findFirst({
    where: and(
      eq(holdoutGroups.id, groupId),
      eq(holdoutGroups.organizationId, organizationId),
    ),
  });
  return row ? normalize(row) : null;
}

export async function setHoldoutActive(
  groupId: string,
  organizationId: string,
  active: boolean,
): Promise<HoldoutGroupSelect | null> {
  const [row] = await db
    .update(holdoutGroups)
    .set({ active, updatedAt: new Date() })
    .where(
      and(
        eq(holdoutGroups.id, groupId),
        eq(holdoutGroups.organizationId, organizationId),
      ),
    )
    .returning();
  return row ? normalize(row) : null;
}

export async function getActiveControlCampaignIds(
  organizationId: string,
): Promise<string[]> {
  const rows = await db
    .select({ controlCampaignIds: holdoutGroups.controlCampaignIds })
    .from(holdoutGroups)
    .where(
      and(
        eq(holdoutGroups.organizationId, organizationId),
        eq(holdoutGroups.active, true),
      ),
    );
  const set = new Set<string>();
  for (const r of rows) {
    for (const id of r.controlCampaignIds) set.add(id);
  }
  return Array.from(set);
}

export interface HoldoutLiftResult {
  groupId: string;
  windowHours: number;
  testCampaignCount: number;
  controlCampaignCount: number;
  test: { spend: number; revenue: number; roas: number };
  control: { spend: number; revenue: number; roas: number };
  /** (test ROAS - control ROAS) / control ROAS — causal lift %. */
  liftPercent: number;
  /** Incremental revenue attributable to orchestrator decisions. */
  incrementalRevenue: number;
  confidence: 'low' | 'medium' | 'high';
}

export async function computeHoldoutLift(
  groupId: string,
  organizationId: string,
  windowHours = 24,
): Promise<HoldoutLiftResult | null> {
  const group = await getHoldoutGroup(groupId, organizationId);
  if (!group) return null;

  const since = new Date(Date.now() - windowHours * 3_600_000);

  const fetchRows = async (ids: string[]) => {
    if (ids.length === 0) return [];
    return db
      .select({
        spend: metricsHourly.spend,
        revenue: metricsHourly.revenue,
      })
      .from(metricsHourly)
      .where(
        and(
          gte(metricsHourly.timestamp, since),
          inArray(metricsHourly.campaignId, ids),
        ),
      );
  };

  const [testRows, controlRows] = await Promise.all([
    fetchRows(group.testCampaignIds),
    fetchRows(group.controlCampaignIds),
  ]);

  const aggregate = (rows: Array<{ spend: string; revenue: string }>) => {
    let spend = 0;
    let revenue = 0;
    for (const r of rows) {
      spend += Number(r.spend);
      revenue += Number(r.revenue);
    }
    return { spend, revenue, roas: orchestratorSafeDivide(revenue, spend) };
  };

  const test = aggregate(testRows);
  const control = aggregate(controlRows);

  const liftPercent =
    control.roas > 0
      ? ((test.roas - control.roas) / control.roas) * 100
      : 0;

  const testSpendShare =
    test.spend + control.spend > 0
      ? test.spend / (test.spend + control.spend)
      : 0;
  const baselineRevenue =
    control.spend > 0 && testSpendShare > 0
      ? (control.revenue / control.spend) * test.spend
      : 0;
  const incrementalRevenue = test.revenue - baselineRevenue;

  const samples = Math.min(testRows.length, controlRows.length);
  const confidence: 'low' | 'medium' | 'high' =
    samples >= 48 ? 'high' : samples >= 12 ? 'medium' : 'low';

  return {
    groupId,
    windowHours,
    testCampaignCount: group.testCampaignIds.length,
    controlCampaignCount: group.controlCampaignIds.length,
    test: {
      spend: round2(test.spend),
      revenue: round2(test.revenue),
      roas: round4(test.roas),
    },
    control: {
      spend: round2(control.spend),
      revenue: round2(control.revenue),
      roas: round4(control.roas),
    },
    liftPercent: round4(liftPercent),
    incrementalRevenue: round2(incrementalRevenue),
    confidence,
  };
}

function normalize(row: typeof holdoutGroups.$inferSelect): HoldoutGroupSelect {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    description: row.description,
    testCampaignIds: (row.testCampaignIds as string[]) ?? [],
    controlCampaignIds: (row.controlCampaignIds as string[]) ?? [],
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
