import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  generateReport,
  listAuditLogs,
} from "../../services/report.service.js";
import { generateReport as generateReportData } from "../../services/report-generator.service.js";
import {
  generateCsvReport,
  generateHtmlReport,
  generateExcelReport,
  type ExportFormat,
} from "../../services/report-export.service.js";
import { organizationProcedure, router } from "../trpc.js";

const ReportType = z.enum(["daily", "weekly", "monthly", "custom"]);

const DbPlatform = z.enum([
  "meta",
  "google",
  "x",
  "tiktok",
  "line_yahoo",
  "amazon",
  "microsoft",
]);

function handleServiceError(error: unknown): never {
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
    cause: error,
  });
}

export const reportsRouter = router({
  generate: organizationProcedure
    .input(
      z.object({
        type: ReportType,
        startDate: z.string().min(1),
        endDate: z.string().min(1),
        platforms: z.array(DbPlatform).optional(),
        includeInsights: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await generateReport(
          {
            reportType: input.type,
            startDate: input.startDate,
            endDate: input.endDate,
            platforms: input.platforms,
            includeInsights: input.includeInsights,
          },
          ctx.organizationId,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  list: organizationProcedure
    .input(
      z
        .object({
          entityType: z.string().optional(),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      try {
        return await listAuditLogs(
          ctx.organizationId,
          input?.entityType,
          input?.limit,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  export: organizationProcedure
    .input(
      z.object({
        type: ReportType,
        startDate: z.string().min(1),
        endDate: z.string().min(1),
        platforms: z.array(DbPlatform).optional(),
        format: z.enum(["csv", "html", "excel"]),
        branding: z
          .object({
            companyName: z.string().optional(),
            logoUrl: z.string().url().optional(),
            primaryColor: z.string().optional(),
            secondaryColor: z.string().optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Generate the full report data first
        const reportData = await generateReportData({
          organizationId: ctx.organizationId,
          reportType: input.type,
          startDate: input.startDate,
          endDate: input.endDate,
          platforms: input.platforms,
          includeInsights: true,
        });

        // Export in the requested format
        const format: ExportFormat = input.format;
        switch (format) {
          case "csv":
            return generateCsvReport(reportData);
          case "html":
            return generateHtmlReport(reportData, input.branding);
          case "excel":
            return generateExcelReport(reportData);
        }
      } catch (error) {
        handleServiceError(error);
      }
    }),
});
