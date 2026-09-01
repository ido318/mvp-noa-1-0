import { z } from "zod";

export const problemListEntrySchema = z.object({
  condition: z.string().trim().min(1),
  // Matches the value an <input type="date"> produces (YYYY-MM-DD). Rejecting
  // anything else here keeps unparseable strings out of the DB — formatIsraelDate
  // throws on invalid dates, so a bad value here would crash the record view.
  onsetDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "onsetDate must be an ISO date (YYYY-MM-DD)")
    .optional()
    .nullable(),
  severity: z.enum(["mild", "moderate", "severe"]).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const updateMedicalRecordSchema = z
  .object({
    summary: z.string().trim().max(12000).optional().nullable(),
    activeProblemList: z.array(problemListEntrySchema).optional(),
    alerts: z.array(z.unknown()).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });
