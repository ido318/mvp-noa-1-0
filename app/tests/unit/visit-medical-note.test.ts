import { describe, expect, it } from "vitest";
import { selectVisitMedicalNote } from "@/lib/visit-medical-note";
import type { MedicalNote } from "@/types/domain/medical-note";

function note(overrides: Partial<MedicalNote>): MedicalNote {
  return {
    id: "note-id",
    clinicId: "clinic-id",
    visitId: "visit-id",
    noteType: "soap_full",
    content: "",
    subjective: null,
    objective: null,
    assessment: null,
    plan: null,
    parentNoteId: null,
    status: "draft",
    approvedByUserId: null,
    approvedAt: null,
    version: 1,
    authorUserId: "user-id",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

describe("selectVisitMedicalNote", () => {
  it("returns null for an empty list", () => {
    expect(selectVisitMedicalNote([])).toBeNull();
  });

  it("prefers the most recent approved note over a later draft", () => {
    const approved = note({ id: "approved", status: "approved", createdAt: "2026-01-01T00:00:00.000Z" });
    const laterDraft = note({ id: "later-draft", status: "draft", createdAt: "2026-01-02T00:00:00.000Z" });
    expect(selectVisitMedicalNote([approved, laterDraft])?.id).toBe("approved");
  });

  it("picks the most recent approved note when there are several", () => {
    const older = note({ id: "older-approved", status: "approved", createdAt: "2026-01-01T00:00:00.000Z" });
    const newer = note({ id: "newer-approved", status: "approved", createdAt: "2026-01-03T00:00:00.000Z" });
    expect(selectVisitMedicalNote([older, newer])?.id).toBe("newer-approved");
  });

  it("falls back to the most recent note of any status when none is approved", () => {
    const older = note({ id: "older-draft", status: "draft", createdAt: "2026-01-01T00:00:00.000Z" });
    const newer = note({ id: "newer-draft", status: "draft", createdAt: "2026-01-02T00:00:00.000Z" });
    expect(selectVisitMedicalNote([older, newer])?.id).toBe("newer-draft");
  });
});
