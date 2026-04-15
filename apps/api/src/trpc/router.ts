import { router } from "./trpc.js";
import { analyticsRouter } from "./procedures/analytics.js";
import { approvalsRouter } from "./procedures/approvals.js";
import { architectRouter } from "./procedures/architect.js";
import { audiencesRouter } from "./procedures/audiences.js";
import { authRouter } from "./procedures/auth.js";
import { budgetsRouter } from "./procedures/budgets.js";
import { campaignsRouter } from "./procedures/campaigns.js";
import { conversionsRouter } from "./procedures/conversions.js";
import { creativesRouter } from "./procedures/creatives.js";
import { dashboardRouter } from "./procedures/dashboard.js";
import { emergencyRouter } from "./procedures/emergency.js";
import { funnelsRouter } from "./procedures/funnels.js";
import { ltvTrackingRouter } from "./procedures/ltv-tracking.js";
import { notificationsRouter } from "./procedures/notifications.js";
import { platformsRouter } from "./procedures/platforms.js";
import { reportsRouter } from "./procedures/reports.js";
import { rulesRouter } from "./procedures/rules.js";
import { aiAutopilotRouter } from "./procedures/ai-autopilot.js";
import { accountAnalysisRouter } from "./procedures/account-analysis.js";
import { competitiveIntelRouter } from "./procedures/competitive-intel.js";
import { creativeMassRouter } from "./procedures/creative-mass.js";
import { abTestEngineRouter } from "./procedures/ab-test-engine.js";
import { videoProjectsRouter } from "./procedures/video-projects.js";
import { groupBuyRouter } from "./procedures/group-buy.js";
import { identityGraphRouter } from "./procedures/identity-graph.js";
import { monthlyFunnelRouter } from "./procedures/monthly-funnel.js";

export const appRouter = router({
  auth: authRouter,
  campaigns: campaignsRouter,
  creatives: creativesRouter,
  analytics: analyticsRouter,
  budgets: budgetsRouter,
  audiences: audiencesRouter,
  funnels: funnelsRouter,
  reports: reportsRouter,
  platforms: platformsRouter,
  rules: rulesRouter,
  notifications: notificationsRouter,
  architect: architectRouter,
  conversions: conversionsRouter,
  approvals: approvalsRouter,
  accountAnalysis: accountAnalysisRouter,
  aiAutopilot: aiAutopilotRouter,
  competitiveIntel: competitiveIntelRouter,
  dashboard: dashboardRouter,
  emergency: emergencyRouter,
  ltvTracking: ltvTrackingRouter,
  creativeMass: creativeMassRouter,
  abTestEngine: abTestEngineRouter,
  videoProjects: videoProjectsRouter,
  groupBuy: groupBuyRouter,
  identityGraph: identityGraphRouter,
  monthlyFunnel: monthlyFunnelRouter,
});

export type AppRouter = typeof appRouter;
