export type MedicalNoteType =
  | "soap_subjective"
  | "soap_objective"
  | "soap_assessment"
  | "soap_plan"
  | "general"
  | "follow_up";

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
