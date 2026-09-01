export type MedicalNoteType =
  | "soap_subjective"
  | "soap_objective"
  | "soap_assessment"
  | "soap_plan"
  | "general"
  | "follow_up"
  | "addendum";

export type MedicalNote = {
  id: string;
  clinicId: string;
  visitId: string;
  noteType: MedicalNoteType;
  content: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  parentNoteId: string | null;
  status: "draft" | "approved" | "archived";
  approvedByUserId: string | null;
  approvedAt: string | null;
  version: number;
  authorUserId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CreateMedicalNoteInput = {
  noteType: MedicalNoteType;
  content: string;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  status?: "draft" | "approved" | "archived";
  parentNoteId?: string | null;
};

export type UpdateMedicalNoteInput = {
  noteType?: MedicalNoteType;
  content?: string;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  status?: "draft" | "approved" | "archived";
};

/**
 * Body shape for POST /visits/:visitId/notes/:noteId/addendum. noteType is
 * fixed to "addendum" and parentNoteId is derived from the :noteId path
 * segment, so neither is client-supplied here.
 */
export type AddMedicalNoteAddendumInput = {
  content: string;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
};
