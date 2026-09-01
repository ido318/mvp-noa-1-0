import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ok } from "@/lib/errors/app-error";
import { AiArtifactService } from "@/lib/services/ai-artifact.service";
import type { ServiceActor } from "@/lib/services/service-context";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const vetActor: ServiceActor = {
  userId: "vet1",
  clinicIds: ["clinic1"],
  defaultClinicId: "clinic1",
  memberships: [{ clinicId: "clinic1", role: "veterinarian" }],
};

const staffActor: ServiceActor = {
  ...vetActor,
  memberships: [{ clinicId: "clinic1", role: "staff" }],
};

function artifact(overrides = {}) {
  return {
    id: "artifact1",
    clinicId: "clinic1",
    artifactType: "patient_summary",
    sourceType: "pet",
    sourceId: "pet1",
    status: "draft",
    draftText: "טיוטה",
    structuredPayload: {},
    modelName: "deterministic-draft",
    promptVersion: "phase9-v1",
    createdByUserId: "vet1",
    reviewedByUserId: null,
    reviewedAt: null,
    rejectionReason: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

describe("Phase 9 AI artifacts", () => {
  it("creates AI output as draft artifact only", async () => {
    const repository = {
      create: vi.fn().mockResolvedValue(ok(artifact())),
    };
    const service = new AiArtifactService(repository as never);

    const result = await service.generateArtifact(vetActor, "draft_soap", {
      clinicId: "clinic1",
      sourceType: "visit",
      sourceId: "visit1",
      sourceText: "הכלב מקיא. לבדוק שתייה.",
    });

    expect(result.ok).toBe(true);
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      artifactType: "draft_soap",
      structuredPayload: expect.objectContaining({ subjective: expect.any(String) }),
    }));
  });

  it("allows veterinarian to approve and records reviewer", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(ok(artifact())),
      review: vi.fn().mockResolvedValue(ok(artifact({
        status: "approved",
        reviewedByUserId: "vet1",
      }))),
    };
    const service = new AiArtifactService(repository as never);

    const result = await service.approveArtifact(vetActor, "artifact1");

    expect(result.ok).toBe(true);
    expect(repository.review).toHaveBeenCalledWith("artifact1", {
      status: "approved",
      reviewedByUserId: "vet1",
    });
  });

  it("rejects staff approval", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(ok(artifact())),
      review: vi.fn(),
    };
    const service = new AiArtifactService(repository as never);

    const result = await service.approveArtifact(staffActor, "artifact1");

    expect(result.ok).toBe(false);
    expect(repository.review).not.toHaveBeenCalled();
  });

  it("stores rejection reason", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(ok(artifact())),
      review: vi.fn().mockResolvedValue(ok(artifact({
        status: "rejected",
        reviewedByUserId: "vet1",
        rejectionReason: "לא מדויק",
      }))),
    };
    const service = new AiArtifactService(repository as never);

    const result = await service.rejectArtifact(vetActor, "artifact1", "לא מדויק");

    expect(result.ok).toBe(true);
    expect(repository.review).toHaveBeenCalledWith("artifact1", {
      status: "rejected",
      reviewedByUserId: "vet1",
      rejectionReason: "לא מדויק",
    });
  });

  it("exposes API routes and approval UI components", () => {
    expect(source("app/api/ai/patient-summary/route.ts")).toContain("patient_summary");
    expect(source("app/api/ai/draft-soap/route.ts")).toContain("draft_soap");
    expect(source("app/api/ai/draft-client-instructions/route.ts")).toContain("client_instructions");
    expect(source("app/api/ai/extract-tasks/route.ts")).toContain("extracted_tasks");
    expect(source("components/dashboard/ai/ai-draft-panel.tsx")).toContain("ApprovalControls");
    expect(source("components/dashboard/ai/ai-safety-notice.tsx")).toContain("אינה רשומה רשמית");
  });
});
