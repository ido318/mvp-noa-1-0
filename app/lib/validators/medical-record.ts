import { z } from "zod";

export const problemListEntrySchema = z.object({
  condition: z.string().trim().min(1),
  onsetDate: z.string().trim().min(1).optional().nullable(),
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
