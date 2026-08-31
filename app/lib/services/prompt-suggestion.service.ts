import { AppError, err, type Result } from "@/lib/errors/app-error";
import { getLiveAgentConfig, publishPrompt, runRegressionTests } from "@/lib/learning/elevenlabsTesting";
import type { PromptSuggestionRepository } from "@/lib/repositories/prompt-suggestion.repository";
import type { ServiceActor } from "@/lib/services/service-context";
import type { PromptSuggestion } from "@/types/domain/prompt-suggestion";

function hasPrivilegedClinicRole(actor: ServiceActor, clinicId: string): boolean {
  return actor.memberships.some(
    (membership) =>
      membership.clinicId === clinicId &&
      (membership.role === "owner" || membership.role === "admin"),
  );
}

export class PromptSuggestionService {
  constructor(private readonly repo: PromptSuggestionRepository) {}

  async listPending(actor: ServiceActor): Promise<Result<PromptSuggestion[]>> {
    return this.repo.listByStatus(actor.clinicIds, "pending");
  }

  async reject(actor: ServiceActor, id: string): Promise<Result<PromptSuggestion>> {
    const existing = await this.repo.findById(id);
    if (!existing.ok) return existing;
    if (!existing.value) return err(AppError.notFound("Prompt suggestion not found"));
    if (!hasPrivilegedClinicRole(actor, existing.value.clinicId)) {
      return err(AppError.forbidden("Only owner or admin can reject prompt suggestions"));
    }
    if (existing.value.status !== "pending") {
      return err(AppError.conflict(`Prompt suggestion already ${existing.value.status}`));
    }

    return this.repo.markRejected(id, actor.userId);
  }

  /**
   * Regression-tests the candidate prompt before publishing. Only publishes
   * when every test passed AND the response could be confidently parsed —
   * an ambiguous response leaves the suggestion pending with the raw result
   * attached, never publishing on an unverified guess. Only category='prompt'
   * suggestions carry a suggested_prompt at all — everything else is marked
   * approved directly, for manual follow-through outside this pipeline.
   */
  async approve(actor: ServiceActor, id: string): Promise<Result<PromptSuggestion>> {
    const existing = await this.repo.findById(id);
    if (!existing.ok) return existing;
    if (!existing.value) return err(AppError.notFound("Prompt suggestion not found"));
    const suggestion = existing.value;

    if (!hasPrivilegedClinicRole(actor, suggestion.clinicId)) {
      return err(AppError.forbidden("Only owner or admin can approve prompt suggestions"));
    }
    if (suggestion.status !== "pending") {
      return err(AppError.conflict(`Prompt suggestion already ${suggestion.status}`));
    }

    if (suggestion.category !== "prompt") {
      return this.repo.markApproved(id, actor.userId);
    }

    if (!suggestion.suggestedPrompt) {
      return err(AppError.internal("prompt suggestion is missing suggested_prompt despite category='prompt'"));
    }

    const regression = await runRegressionTests(suggestion.suggestedPrompt).catch((error: unknown) => {
      throw AppError.externalProvider(
        "Failed to run ElevenLabs regression tests",
        error instanceof Error ? error.message : error,
      );
    });

    if (regression.allPassed !== true) {
      // Covers both a confirmed failure and an ambiguous/unparseable response —
      // either way we do not publish. Status distinguishes the two for the UI.
      return this.repo.recordRegressionResult(id, {
        status: regression.allPassed === false ? "failed_regression" : "pending",
        regressionResult: regression.raw,
        reviewedByUserId: actor.userId,
      });
    }

    let previousPrompt: Record<string, unknown>;
    let publishResult: Record<string, unknown>;
    try {
      previousPrompt = await getLiveAgentConfig();
      publishResult = await publishPrompt(suggestion.suggestedPrompt);
    } catch (error) {
      return err(
        AppError.externalProvider(
          "Regression passed but publish failed",
          error instanceof Error ? error.message : error,
        ),
      );
    }

    return this.repo.markPublished(id, {
      regressionResult: regression.raw,
      previousPrompt,
      publishResult,
      reviewedByUserId: actor.userId,
    });
  }
}
