/**
 * Group Buy Service (Pinduoduo Model)
 *
 * Social commerce group buying engine with tiered discounts
 * and referral-driven viral loops.
 */

import { db } from '@omni-ad/db';
import {
  purchaseGroups,
  groupShareEvents,
  type GroupParticipant,
  type GroupTier,
} from '@omni-ad/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PurchaseGroupSelect = typeof purchaseGroups.$inferSelect;
type GroupShareEventSelect = typeof groupShareEvents.$inferSelect;
type Platform = GroupShareEventSelect['platform'];
type ShareType = GroupShareEventSelect['shareType'];

export interface CreateGroupCampaignInput {
  campaignId: string;
  tiers: GroupTier[];
  expiresInHours: number;
}

export interface JoinGroupInput {
  groupId: string;
  userId: string;
  sourcePlatform: string;
  referralChain: string[];
}

export interface CreateGroupInput {
  campaignId: string;
  initiatorId: string;
  tiers: GroupTier[];
  expiresInHours: number;
}

export interface GroupStatusResult {
  id: string;
  status: PurchaseGroupSelect['status'];
  currentTier: number;
  participantCount: number;
  tiers: GroupTier[];
  nextTier: GroupTier | null;
  participantsToNextTier: number;
  expiresAt: Date;
  referralCode: string;
}

export interface PaginatedGroups {
  groups: PurchaseGroupSelect[];
  total: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateReferralCode(): string {
  return randomBytes(8).toString('hex').toUpperCase();
}

function computeCurrentTier(
  participantCount: number,
  tiers: GroupTier[],
): number {
  let currentTier = 0;
  const sortedTiers = [...tiers].sort(
    (a, b) => a.minParticipants - b.minParticipants,
  );

  for (let i = 0; i < sortedTiers.length; i++) {
    const tier = sortedTiers[i]!;
    if (participantCount >= tier.minParticipants) {
      currentTier = i + 1;
    }
  }

  return currentTier;
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

export async function createGroup(
  organizationId: string,
  input: CreateGroupInput,
): Promise<PurchaseGroupSelect> {
  const sortedTiers = [...input.tiers].sort(
    (a, b) => a.minParticipants - b.minParticipants,
  );

  if (sortedTiers.length === 0) {
    throw new GroupBuyValidationError('At least one tier is required');
  }

  const referralCode = generateReferralCode();
  const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000);

  const initialParticipant: GroupParticipant = {
    userId: input.initiatorId,
    joinedAt: new Date().toISOString(),
    sourcePlatform: 'direct',
    referralChain: [],
  };

  const [group] = await db
    .insert(purchaseGroups)
    .values({
      organizationId,
      campaignId: input.campaignId,
      initiatorId: input.initiatorId,
      referralCode,
      currentTier: 0,
      participantCount: 1,
      participants: [initialParticipant],
      tiers: sortedTiers,
      status: 'open',
      expiresAt,
    })
    .returning();

  if (!group) {
    throw new GroupBuyCreationError('Failed to create purchase group');
  }

  return group;
}

export async function joinGroup(
  organizationId: string,
  input: JoinGroupInput,
): Promise<PurchaseGroupSelect> {
  const group = await db.query.purchaseGroups.findFirst({
    where: and(
      eq(purchaseGroups.id, input.groupId),
      eq(purchaseGroups.organizationId, organizationId),
    ),
  });

  if (!group) {
    throw new GroupBuyNotFoundError(input.groupId);
  }

  if (group.status !== 'open') {
    throw new GroupBuyStateError(
      `Cannot join group in status: ${group.status}`,
    );
  }

  if (new Date() > group.expiresAt) {
    // Mark as expired
    await db
      .update(purchaseGroups)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(purchaseGroups.id, group.id));

    throw new GroupBuyStateError('Group has expired');
  }

  // Check if user already in group
  const existingParticipants = group.participants as GroupParticipant[];
  if (existingParticipants.some((p) => p.userId === input.userId)) {
    throw new GroupBuyValidationError('User already in this group');
  }

  const newParticipant: GroupParticipant = {
    userId: input.userId,
    joinedAt: new Date().toISOString(),
    sourcePlatform: input.sourcePlatform,
    referralChain: input.referralChain,
  };

  const newParticipantCount = group.participantCount + 1;
  const newTier = computeCurrentTier(
    newParticipantCount,
    group.tiers as GroupTier[],
  );

  // Check if threshold met
  const maxTier = (group.tiers as GroupTier[]).length;
  const newStatus = newTier >= maxTier ? 'threshold_met' : 'open';

  const [updated] = await db
    .update(purchaseGroups)
    .set({
      participantCount: newParticipantCount,
      participants: sql`${purchaseGroups.participants} || ${JSON.stringify(newParticipant)}::jsonb`,
      currentTier: newTier,
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(purchaseGroups.id, group.id))
    .returning();

  if (!updated) {
    throw new GroupBuyNotFoundError(input.groupId);
  }

  return updated;
}

export async function getGroupStatus(
  groupId: string,
  organizationId: string,
): Promise<GroupStatusResult> {
  const group = await db.query.purchaseGroups.findFirst({
    where: and(
      eq(purchaseGroups.id, groupId),
      eq(purchaseGroups.organizationId, organizationId),
    ),
  });

  if (!group) {
    throw new GroupBuyNotFoundError(groupId);
  }

  const tiers = group.tiers as GroupTier[];
  const sortedTiers = [...tiers].sort(
    (a, b) => a.minParticipants - b.minParticipants,
  );

  const nextTier = sortedTiers.find(
    (t) => t.minParticipants > group.participantCount,
  ) ?? null;

  const participantsToNextTier = nextTier
    ? nextTier.minParticipants - group.participantCount
    : 0;

  return {
    id: group.id,
    status: group.status,
    currentTier: group.currentTier,
    participantCount: group.participantCount,
    tiers: sortedTiers,
    nextTier,
    participantsToNextTier,
    expiresAt: group.expiresAt,
    referralCode: group.referralCode,
  };
}

export async function listGroups(
  organizationId: string,
  campaignId: string,
  limit = 50,
  offset = 0,
): Promise<PaginatedGroups> {
  const [groups, countResult] = await Promise.all([
    db.query.purchaseGroups.findMany({
      where: and(
        eq(purchaseGroups.organizationId, organizationId),
        eq(purchaseGroups.campaignId, campaignId),
      ),
      orderBy: [desc(purchaseGroups.createdAt)],
      limit,
      offset,
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(purchaseGroups)
      .where(
        and(
          eq(purchaseGroups.organizationId, organizationId),
          eq(purchaseGroups.campaignId, campaignId),
        ),
      ),
  ]);

  return {
    groups,
    total: countResult[0]?.count ?? 0,
  };
}

export async function getShareLink(
  groupId: string,
  organizationId: string,
  sharerId: string,
  platform: Platform,
  shareType: ShareType,
): Promise<{ shareUrl: string; eventId: string }> {
  const group = await db.query.purchaseGroups.findFirst({
    where: and(
      eq(purchaseGroups.id, groupId),
      eq(purchaseGroups.organizationId, organizationId),
    ),
  });

  if (!group) {
    throw new GroupBuyNotFoundError(groupId);
  }

  // Record share event
  const [event] = await db
    .insert(groupShareEvents)
    .values({
      groupId,
      sharerId,
      platform,
      shareType,
      clicks: 0,
      conversions: 0,
    })
    .returning();

  if (!event) {
    throw new GroupBuyCreationError('Failed to create share event');
  }

  // The share URL would be constructed with the app's base URL
  const baseUrl = process.env['APP_BASE_URL'] ?? 'https://app.omni-ad.jp';
  const shareUrl = `${baseUrl}/group/${group.referralCode}?ref=${sharerId}&evt=${event.id}`;

  return { shareUrl, eventId: event.id };
}

export async function createGroupCampaign(
  organizationId: string,
  input: CreateGroupCampaignInput,
): Promise<PurchaseGroupSelect> {
  // Create a template group for the campaign that others can clone
  return createGroup(organizationId, {
    campaignId: input.campaignId,
    initiatorId: 'system',
    tiers: input.tiers,
    expiresInHours: input.expiresInHours,
  });
}

// ---------------------------------------------------------------------------
// Custom Errors
// ---------------------------------------------------------------------------

export class GroupBuyNotFoundError extends Error {
  constructor(groupId: string) {
    super(`Purchase group not found: ${groupId}`);
    this.name = 'GroupBuyNotFoundError';
  }
}

export class GroupBuyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GroupBuyValidationError';
  }
}

export class GroupBuyStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GroupBuyStateError';
  }
}

export class GroupBuyCreationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GroupBuyCreationError';
  }
}
