import { z } from "zod";

export const updateMedicalRecordSchema = z
  .object({
    summary: z.string().trim().max(12000).optional().nullable(),
    activeProblemList: z.array(z.unknown()).optional(),
    alerts: z.array(z.unknown()).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });
