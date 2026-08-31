import { z } from "zod";

export const medicalNoteTypeSchema = z.enum([
  "soap_subjective",
  "soap_objective",
  "soap_assessment",
  "soap_plan",
  "general",
  "follow_up",
]);

export const medicalNoteStatusSchema = z.enum(["draft", "approved", "archived"]);

export const createMedicalNoteSchema = z.object({
  noteType: medicalNoteTypeSchema,
  content: z.string().trim().min(1).max(16000),
  subjective: z.string().trim().max(16000).optional().nullable(),
  objective: z.string().trim().max(16000).optional().nullable(),
  assessment: z.string().trim().max(16000).optional().nullable(),
  plan: z.string().trim().max(16000).optional().nullable(),
  status: medicalNoteStatusSchema.optional(),
});

export const updateMedicalNoteSchema = z
  .object({
    noteType: medicalNoteTypeSchema.optional(),
    content: z.string().trim().min(1).max(16000).optional(),
    subjective: z.string().trim().max(16000).optional().nullable(),
    objective: z.string().trim().max(16000).optional().nullable(),
    assessment: z.string().trim().max(16000).optional().nullable(),
    plan: z.string().trim().max(16000).optional().nullable(),
    status: medicalNoteStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });
