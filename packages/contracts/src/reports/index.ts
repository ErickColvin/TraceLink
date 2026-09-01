import { z } from "zod";

import {
  clpAmountSchema,
  entityIdSchema,
  isoDateSchema,
  isoDateTimeSchema,
  nonNegativeIntegerSchema,
} from "../common/index.js";

export const REPORT_CATEGORIES = [
  "SALES",
  "ORDERS",
  "INVENTORY",
  "PACKAGES",
] as const;
export const REPORT_STATUSES = ["OK", "ATTENTION", "CRITICAL"] as const;

export const reportCategorySchema = z.enum(REPORT_CATEGORIES);
export const reportStatusSchema = z.enum(REPORT_STATUSES);

export const operationalReportRecordSchema = z
  .object({
    id: entityIdSchema,
    date: isoDateSchema,
    category: reportCategorySchema,
    status: reportStatusSchema,
    title: z.string().trim().min(1).max(200),
    reference: z.string().trim().min(1).max(200),
    quantity: nonNegativeIntegerSchema,
    amountClp: clpAmountSchema.optional(),
  })
  .strict();

export const reportListParamsSchema = z
  .object({
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    category: reportCategorySchema.optional(),
    status: reportStatusSchema.optional(),
  })
  .strict()
  .superRefine((params, context) => {
    if (params.from && params.to && params.from > params.to) {
      context.addIssue({
        code: "custom",
        message: "from no puede ser posterior a to.",
        path: ["from"],
      });
    }
  });

export const operationalReportSchema = z
  .object({
    generatedAt: isoDateTimeSchema,
    items: z.array(operationalReportRecordSchema),
    summary: z
      .object({
        records: nonNegativeIntegerSchema,
        quantity: nonNegativeIntegerSchema,
        amountClp: clpAmountSchema,
        critical: nonNegativeIntegerSchema,
      })
      .strict(),
  })
  .strict();

export type ReportCategory = z.infer<typeof reportCategorySchema>;
export type ReportStatus = z.infer<typeof reportStatusSchema>;
export type OperationalReportRecord = z.infer<
  typeof operationalReportRecordSchema
>;
export type ReportListParams = z.infer<typeof reportListParamsSchema>;
export type OperationalReport = z.infer<typeof operationalReportSchema>;
