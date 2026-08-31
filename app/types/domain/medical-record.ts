export type MedicalRecord = {
  id: string;
  clinicId: string;
  petId: string;
  summary: string | null;
  activeProblemList: unknown[];
  alerts: unknown[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type EnsureMedicalRecordForPetInput = {
  clinicId: string;
  petId: string;
};

export type UpdateMedicalRecordInput = {
  summary?: string | null;
  activeProblemList?: unknown[];
  alerts?: unknown[];
};
