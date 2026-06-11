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
  authorUserId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CreateMedicalNoteInput = {
  noteType: MedicalNoteType;
  content: string;
};

export type UpdateMedicalNoteInput = {
  noteType?: MedicalNoteType;
  content?: string;
};
