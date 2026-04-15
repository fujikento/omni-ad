import { generateReportJobSchema, type GenerateReportJob } from '@omni-ad/queue';
import { db } from '@omni-ad/db';
import { campaigns, metricsDaily, notifications, reports } from '@omni-ad/db/schema';
import { and, between, eq, sql, desc } from 'drizzle-orm';

interface ProcessorLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const logger: ProcessorLogger = {
  info(message, meta) {
    process.stdout.write(`[reporting] INFO: ${message} ${meta ? JSON.stringify(meta) : ''}\n`);
  },
  error(message, meta) {
    process.stderr.write(`[reporting] ERROR: ${message} ${meta ? JSON.stringify(meta) : ''}\n`);
  },
};

interface ReportSummary {
  totalSpend: number;
  totalRevenue: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  overallRoas: number;
  activeCampaigns: number;
}

interface PlatformBreakdown {
  platform: string;
  spend: number;
  revenue: number;
  roas: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export async function processReporting(job: { name: string; data: unknown }): Promise<void> {
  const parsed = generateReportJobSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new Error(`Invalid job data: ${parsed.error.message}`);
  }

  const data: GenerateReportJob = parsed.data;
  const startDate = data.startDate.slice(0, 10);
  const endDate = data.endDate.slice(0, 10);

  logger.info('Generating report', {
    organizationId: data.organizationId,
    reportType: data.reportType,
    startDate,
    endDate,
  });

  try {
    // Aggregate overview metrics
    const summary = await fetchSummary(data.organizationId, startDate, endDate);

    // Per-platform breakdown
    const platformBreakdown = await fetchPlatformBreakdown(data.organizationId, startDate, endDate);

    // Top campaigns by spend
    const topCampaigns = await fetchTopCampaigns(data.organizationId, startDate, endDate, 5);

    logger.info('Report generated successfully', {
      organizationId: data.organizationId,
      reportType: data.reportType,
      totalSpend: summary.totalSpend,
      overallRoas: summary.overallRoas,
      platformCount: platformBreakdown.length,
      topCampaignCount: topCampaigns.length,
    });

    // Persist the full report payload so the UI and downstream exports can
    // retrieve it later. The accompanying notification surfaces completion
    // to the dashboard in real time.
    const reportPayload = {
      reportType: data.reportType,
      startDate,
      endDate,
      summary,
      platformBreakdown,
      topCampaigns,
    } satisfies Record<string, unknown>;

    await db.insert(reports).values({
      organizationId: data.organizationId,
      type: data.reportType,
      format: 'json',
      data: reportPayload,
    });

    await db.insert(notifications).values({
      organizationId: data.organizationId,
      userId: null,
      type: 'info',
      title: 'レポート生成完了',
      message:
        `${data.reportType} レポート (${startDate} ～ ${endDate}) を生成しました。` +
        `総支出 ¥${summary.totalSpend.toLocaleString('ja-JP')} / ROAS ${summary.overallRoas.toFixed(2)}`,
      source: 'reporting',
      actionUrl: '/reports',
      metadata: {
        reportType: data.reportType,
        startDate,
        endDate,
        summary,
        platformBreakdown,
        topCampaigns,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Report generation failed', {
      organizationId: data.organizationId,
      error: message,
    });
    throw err;
  }
}

async function fetchSummary(
  organizationId: string,
  startDate: string,
  endDate: string,
): Promise<ReportSummary> {
  const activeCampaignResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.organizationId, organizationId),
        eq(campaigns.status, 'active'),
      ),
    );

  const [metrics] = await db
    .select({
      totalSpend: sql<string>`COALESCE(SUM(${metricsDaily.spend}), 0)::numeric(14,2)::text`,
      totalRevenue: sql<string>`COALESCE(SUM(${metricsDaily.revenue}), 0)::numeric(14,2)::text`,
      totalImpressions: sql<number>`COALESCE(SUM(${metricsDaily.impressions}), 0)::int`,
      totalClicks: sql<number>`COALESCE(SUM(${metricsDaily.clicks}), 0)::int`,
      totalConversions: sql<number>`COALESCE(SUM(${metricsDaily.conversions}), 0)::int`,
    })
    .from(metricsDaily)
    .innerJoin(campaigns, eq(metricsDaily.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.organizationId, organizationId),
        between(metricsDaily.date, startDate, endDate),
      ),
    );

  const totalSpend = Number(metrics?.totalSpend ?? '0');
  const totalRevenue = Number(metrics?.totalRevenue ?? '0');

  return {
    totalSpend,
    totalRevenue,
    totalImpressions: metrics?.totalImpressions ?? 0,
    totalClicks: metrics?.totalClicks ?? 0,
    totalConversions: metrics?.totalConversions ?? 0,
    overallRoas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
    activeCampaigns: activeCampaignResult[0]?.count ?? 0,
  };
}

async function fetchPlatformBreakdown(
  organizationId: string,
  startDate: string,
  endDate: string,
): Promise<PlatformBreakdown[]> {
  const rows = await db
    .select({
      platform: metricsDaily.platform,
      spend: sql<string>`COALESCE(SUM(${metricsDaily.spend}), 0)::numeric(14,2)::text`,
      revenue: sql<string>`COALESCE(SUM(${metricsDaily.revenue}), 0)::numeric(14,2)::text`,
      impressions: sql<number>`COALESCE(SUM(${metricsDaily.impressions}), 0)::int`,
      clicks: sql<number>`COALESCE(SUM(${metricsDaily.clicks}), 0)::int`,
      conversions: sql<number>`COALESCE(SUM(${metricsDaily.conversions}), 0)::int`,
    })
    .from(metricsDaily)
    .innerJoin(campaigns, eq(metricsDaily.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.organizationId, organizationId),
        between(metricsDaily.date, startDate, endDate),
      ),
    )
    .groupBy(metricsDaily.platform);

  return rows.map((row) => {
    const spend = Number(row.spend);
    const revenue = Number(row.revenue);
    return {
      platform: row.platform,
      spend,
      revenue,
      roas: spend > 0 ? revenue / spend : 0,
      impressions: row.impressions,
      clicks: row.clicks,
      conversions: row.conversions,
    };
  });
}

async function fetchTopCampaigns(
  organizationId: string,
  startDate: string,
  endDate: string,
  limit: number,
): Promise<{ campaignId: string; campaignName: string; spend: number; roas: number }[]> {
  const rows = await db
    .select({
      campaignId: metricsDaily.campaignId,
      campaignName: campaigns.name,
      spend: sql<string>`COALESCE(SUM(${metricsDaily.spend}), 0)::numeric(14,2)::text`,
      revenue: sql<string>`COALESCE(SUM(${metricsDaily.revenue}), 0)::numeric(14,2)::text`,
    })
    .from(metricsDaily)
    .innerJoin(campaigns, eq(metricsDaily.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.organizationId, organizationId),
        between(metricsDaily.date, startDate, endDate),
      ),
    )
    .groupBy(metricsDaily.campaignId, campaigns.name)
    .orderBy(desc(sql`SUM(${metricsDaily.spend})`))
    .limit(limit);

  return rows.map((row) => {
    const spend = Number(row.spend);
    const revenue = Number(row.revenue);
    return {
      campaignId: row.campaignId,
      campaignName: row.campaignName,
      spend,
      roas: spend > 0 ? revenue / spend : 0,
    };
  });
}
