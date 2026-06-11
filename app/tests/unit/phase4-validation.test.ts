import { describe, expect, it } from "vitest";
import { assertMedicalDeleteAuthorized } from "@/lib/services/medical-authorization";
import { createMedicalNoteSchema } from "@/lib/validators/medical-note";
import { createPrescriptionSchema } from "@/lib/validators/prescription";
import { createVaccinationSchema } from "@/lib/validators/vaccination";
import {
  createVisitSchema,
  deleteVisitSchema,
  updateVisitSchema,
} from "@/lib/validators/visit";

describe("phase4 validators", () => {
  it("accepts valid create visit payload", () => {
    const result = createVisitSchema.safeParse({
      clinicId: "00000000-0000-4000-8000-000000000001",
      customerId: "00000000-0000-4000-8000-000000000010",
      petId: "00000000-0000-4000-8000-000000000011",
    });
    expect(result.success).toBe(true);
  });

  it("requires version for visit updates", () => {
    const result = updateVisitSchema.safeParse({ status: "completed" });
    expect(result.success).toBe(false);
  });

  it("requires version for visit delete", () => {
    const result = deleteVisitSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty medical note content", () => {
    const result = createMedicalNoteSchema.safeParse({
      noteType: "general",
      content: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("accepts vaccination with administered timestamp", () => {
    const result = createVaccinationSchema.safeParse({
      clinicId: "00000000-0000-4000-8000-000000000001",
      customerId: "00000000-0000-4000-8000-000000000010",
      vaccineName: "Rabies",
      administeredAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it("allows owner/admin/veterinarian medical delete roles", () => {
    const actor = {
      userId: "user-1",
      clinicIds: ["clinic-1"],
      defaultClinicId: "clinic-1",
      memberships: [{ clinicId: "clinic-1", role: "veterinarian" as const }],
    };
    expect(assertMedicalDeleteAuthorized(actor, "clinic-1").ok).toBe(true);
  });

  it("denies staff medical delete role", () => {
    const actor = {
      userId: "user-2",
      clinicIds: ["clinic-1"],
      defaultClinicId: "clinic-1",
      memberships: [{ clinicId: "clinic-1", role: "staff" as const }],
    };
    expect(assertMedicalDeleteAuthorized(actor, "clinic-1").ok).toBe(false);
  });

  it("requires prescription instructions", () => {
    const result = createPrescriptionSchema.safeParse({
      medicationName: "Amoxicillin",
      instructions: "",
    });
    expect(result.success).toBe(false);
  });
});
