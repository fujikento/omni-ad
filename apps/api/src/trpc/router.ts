import { router } from "./trpc.js";
import { analyticsRouter } from "./procedures/analytics.js";
import { approvalsRouter } from "./procedures/approvals.js";
import { architectRouter } from "./procedures/architect.js";
import { audiencesRouter } from "./procedures/audiences.js";
import { budgetsRouter } from "./procedures/budgets.js";
import { campaignsRouter } from "./procedures/campaigns.js";
import { conversionsRouter } from "./procedures/conversions.js";
import { creativesRouter } from "./procedures/creatives.js";
import { funnelsRouter } from "./procedures/funnels.js";
import { notificationsRouter } from "./procedures/notifications.js";
import { platformsRouter } from "./procedures/platforms.js";
import { reportsRouter } from "./procedures/reports.js";
import { rulesRouter } from "./procedures/rules.js";
import { aiAutopilotRouter } from "./procedures/ai-autopilot.js";

export const appRouter = router({
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
  aiAutopilot: aiAutopilotRouter,
});

export type AppRouter = typeof appRouter;
