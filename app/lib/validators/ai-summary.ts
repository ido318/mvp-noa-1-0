import { z } from "zod";

export const aiSourceTypeSchema = z.enum(["pet", "visit", "call"]);

const generateAiArtifactSchema = z.object({
  clinicId: z.string().uuid(),
  sourceType: aiSourceTypeSchema,
  sourceId: z.string().uuid().optional().nullable(),
  sourceText: z.string().trim().min(1).max(8000),
});

export const patientSummarySchema = generateAiArtifactSchema;
export const draftSoapSchema = generateAiArtifactSchema;
export const draftClientInstructionsSchema = generateAiArtifactSchema;
export const extractTasksSchema = generateAiArtifactSchema;

export const rejectAiArtifactSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});
