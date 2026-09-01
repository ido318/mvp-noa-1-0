import { z } from "zod";

export const medicalNoteTypeSchema = z.enum([
  "soap_subjective",
  "soap_objective",
  "soap_assessment",
  "soap_plan",
  "soap_full",
  "general",
  "follow_up",
  "addendum",
]);

export const medicalNoteStatusSchema = z.enum(["draft", "approved", "archived"]);

/**
 * Shared invariant for both create and update payloads: parentNoteId is
 * required (and must be non-null) exactly when noteType is "addendum", and
 * must be absent/null for every other noteType. Mirrors the self-referencing
 * parent_note_id column added in
 * supabase/migrations/20260901172952_medical_notes_lock_and_addendum.sql.
 */
function refineParentNoteId(
  value: { noteType?: string; parentNoteId?: string | null },
  ctx: z.RefinementCtx,
) {
  if (value.noteType === "addendum") {
    if (!value.parentNoteId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentNoteId"],
        message: "parentNoteId is required when noteType is 'addendum'",
      });
    }
  } else if (value.parentNoteId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["parentNoteId"],
      message: "parentNoteId is only allowed when noteType is 'addendum'",
    });
  }
}

export const createMedicalNoteSchema = z
  .object({
    noteType: medicalNoteTypeSchema,
    content: z.string().trim().min(1).max(16000),
    subjective: z.string().trim().max(16000).optional().nullable(),
    objective: z.string().trim().max(16000).optional().nullable(),
    assessment: z.string().trim().max(16000).optional().nullable(),
    plan: z.string().trim().max(16000).optional().nullable(),
    status: medicalNoteStatusSchema.optional(),
    parentNoteId: z.string().uuid().optional().nullable(),
  })
  .superRefine(refineParentNoteId);

export const updateMedicalNoteSchema = z
  .object({
    noteType: medicalNoteTypeSchema.optional(),
    content: z.string().trim().min(1).max(16000).optional(),
    subjective: z.string().trim().max(16000).optional().nullable(),
    objective: z.string().trim().max(16000).optional().nullable(),
    assessment: z.string().trim().max(16000).optional().nullable(),
    plan: z.string().trim().max(16000).optional().nullable(),
    status: medicalNoteStatusSchema.optional(),
    parentNoteId: z.string().uuid().optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  })
  .superRefine(refineParentNoteId);

/**
 * Body for POST /visits/:visitId/notes/:noteId/addendum. noteType is fixed
 * to "addendum" and parentNoteId comes from the :noteId path segment, so
 * neither is part of the request body here.
 */
export const addMedicalNoteAddendumSchema = z.object({
  content: z.string().trim().min(1).max(16000),
  subjective: z.string().trim().max(16000).optional().nullable(),
  objective: z.string().trim().max(16000).optional().nullable(),
  assessment: z.string().trim().max(16000).optional().nullable(),
  plan: z.string().trim().max(16000).optional().nullable(),
});
