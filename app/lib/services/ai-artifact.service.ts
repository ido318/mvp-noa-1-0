import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import type { AiSummaryRepository } from "@/lib/repositories/ai-summary.repository";
import { assertVisitSummaryAiAuthorized } from "@/lib/services/medical-authorization";
import type { ServiceActor } from "@/lib/services/service-context";
import type {
  AiArtifactSourceType,
  AiArtifactType,
  AiSummary,
} from "@/types/domain/ai-summary";

type GenerateInput = {
  clinicId: string;
  sourceType: AiArtifactSourceType;
  sourceId?: string | null;
  sourceText: string;
};

const TYPE_PREFIX: Record<AiArtifactType, string> = {
  patient_summary: "טיוטת סיכום מטופל",
  draft_soap: "טיוטת SOAP",
  client_instructions: "טיוטת הנחיות ללקוח",
  extracted_tasks: "טיוטת משימות מוצעות",
};

export class AiArtifactService {
  constructor(private readonly repository: AiSummaryRepository) {}

  async generateArtifact(
    actor: ServiceActor,
    artifactType: AiArtifactType,
    input: GenerateInput,
  ): Promise<Result<AiSummary>> {
    if (!actor.clinicIds.includes(input.clinicId)) {
      return err(AppError.forbidden("Cannot create AI artifact for requested clinic"));
    }

    const text = input.sourceText.trim();
    const draftText = `${TYPE_PREFIX[artifactType]}:\n${text.slice(0, 1400)}`;
    const structuredPayload = artifactType === "draft_soap"
      ? buildSoapPayload(text)
      : artifactType === "extracted_tasks"
        ? { tasks: extractTaskCandidates(text) }
        : { sourceLength: text.length };

    return this.repository.create({
      clinicId: input.clinicId,
      artifactType,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      draftText,
      structuredPayload,
      modelName: "deterministic-draft",
      promptVersion: "phase9-v1",
      createdByUserId: actor.userId,
    });
  }

  async approveArtifact(actor: ServiceActor, artifactId: string): Promise<Result<AiSummary>> {
    const artifact = await this.loadReviewable(actor, artifactId);
    if (!artifact.ok) return artifact;
    return this.repository.review(artifactId, {
      status: "approved",
      reviewedByUserId: actor.userId,
    });
  }

  async rejectArtifact(
    actor: ServiceActor,
    artifactId: string,
    reason: string,
  ): Promise<Result<AiSummary>> {
    const artifact = await this.loadReviewable(actor, artifactId);
    if (!artifact.ok) return artifact;
    return this.repository.review(artifactId, {
      status: "rejected",
      reviewedByUserId: actor.userId,
      rejectionReason: reason,
    });
  }

  private async loadReviewable(
    actor: ServiceActor,
    artifactId: string,
  ): Promise<Result<AiSummary>> {
    const artifact = await this.repository.findById(artifactId);
    if (!artifact.ok) return artifact;
    if (!artifact.value) return err(AppError.notFound("AI artifact not found"));
    if (!actor.clinicIds.includes(artifact.value.clinicId)) {
      return err(AppError.forbidden("AI artifact outside actor clinics"));
    }
    const authorized = assertVisitSummaryAiAuthorized(actor, artifact.value.clinicId);
    if (!authorized.ok) return authorized;
    return ok(artifact.value);
  }
}

function buildSoapPayload(text: string): Record<string, string> {
  return {
    subjective: text,
    objective: "",
    assessment: "",
    plan: "",
  };
}

function extractTaskCandidates(text: string): string[] {
  return text
    .split(/\n|\.|;|-/)
    .map((item) => item.trim())
    .filter((item) => item.length > 3)
    .slice(0, 8);
}
