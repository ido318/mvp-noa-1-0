import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import type { PromptSuggestion, PromptSuggestionCategory, PromptSuggestionStatus } from "@/types/domain/prompt-suggestion";

function isNoRowsMatchedError(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "PGRST116";
}

function mapPromptSuggestionRow(row: Record<string, unknown>): PromptSuggestion {
  return {
    id: row.id as string,
    clinicId: row.clinic_id as string,
    status: row.status as PromptSuggestionStatus,
    category: row.category as PromptSuggestionCategory,
    targetFile: (row.target_file as string | null) ?? null,
    patternSummary: row.pattern_summary as string,
    proposedChange: (row.proposed_change as string | null) ?? null,
    rootCause: (row.root_cause as string | null) ?? null,
    suggestedPrompt: (row.suggested_prompt as string | null) ?? null,
    supportingCallReviewIds: (row.supporting_call_review_ids as string[] | null) ?? [],
    regressionResult: (row.regression_result as Record<string, unknown> | null) ?? null,
    previousPrompt: (row.previous_prompt as Record<string, unknown> | null) ?? null,
    publishResult: (row.publish_result as Record<string, unknown> | null) ?? null,
    reviewedByUserId: (row.reviewed_by_user_id as string | null) ?? null,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    publishedAt: (row.published_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/**
 * Backed by the service-role client. `prompt_suggestions` is deny-by-default
 * under RLS (same pattern as visit_shares), so this repository must be
 * constructed with the admin client. Permission checks happen one layer up,
 * in PromptSuggestionService.
 */
export class PromptSuggestionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listByStatus(clinicIds: string[], status: PromptSuggestionStatus): Promise<Result<PromptSuggestion[]>> {
    const { data, error } = await this.client
      .from("prompt_suggestions")
      .select("*")
      .in("clinic_id", clinicIds)
      .eq("status", status)
      .order("created_at", { ascending: false });
    if (error) return err(AppError.externalProvider("Failed to list prompt suggestions", error));
    return ok((data ?? []).map(mapPromptSuggestionRow));
  }

  async findById(id: string): Promise<Result<PromptSuggestion | null>> {
    const { data, error } = await this.client
      .from("prompt_suggestions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return err(AppError.externalProvider("Failed to load prompt suggestion", error));
    return ok(data ? mapPromptSuggestionRow(data as Record<string, unknown>) : null);
  }

  /** Guarded by `.eq("status", "pending")` — a concurrent review already in flight loses this race cleanly. */
  async markRejected(id: string, reviewedByUserId: string): Promise<Result<PromptSuggestion>> {
    const { data, error } = await this.client
      .from("prompt_suggestions")
      .update({
        status: "rejected",
        reviewed_by_user_id: reviewedByUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending")
      .select("*")
      .single();
    if (error) {
      if (isNoRowsMatchedError(error)) {
        return err(AppError.conflict("Prompt suggestion was already reviewed by someone else"));
      }
      return err(AppError.externalProvider("Failed to reject prompt suggestion", error));
    }
    return ok(mapPromptSuggestionRow(data));
  }

  /** Guarded by `.eq("status", "pending")` — a concurrent review already in flight loses this race cleanly. */
  async markApproved(id: string, reviewedByUserId: string): Promise<Result<PromptSuggestion>> {
    const { data, error } = await this.client
      .from("prompt_suggestions")
      .update({
        status: "approved",
        reviewed_by_user_id: reviewedByUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending")
      .select("*")
      .single();
    if (error) {
      if (isNoRowsMatchedError(error)) {
        return err(AppError.conflict("Prompt suggestion was already reviewed by someone else"));
      }
      return err(AppError.externalProvider("Failed to approve prompt suggestion", error));
    }
    return ok(mapPromptSuggestionRow(data));
  }

  /**
   * Regression ran but the response couldn't be trusted, or a test failed — persist and stop.
   * Guarded by `.eq("status", "pending")` — a concurrent review already in flight loses this race cleanly.
   */
  async recordRegressionResult(
    id: string,
    input: { status: "pending" | "failed_regression"; regressionResult: Record<string, unknown>; reviewedByUserId: string },
  ): Promise<Result<PromptSuggestion>> {
    const { data, error } = await this.client
      .from("prompt_suggestions")
      .update({
        status: input.status,
        regression_result: input.regressionResult,
        reviewed_by_user_id: input.reviewedByUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending")
      .select("*")
      .single();
    if (error) {
      if (isNoRowsMatchedError(error)) {
        return err(AppError.conflict("Prompt suggestion was already reviewed by someone else"));
      }
      return err(AppError.externalProvider("Failed to record regression result", error));
    }
    return ok(mapPromptSuggestionRow(data));
  }

  /** Guarded by `.eq("status", "pending")` — a concurrent review already in flight loses this race cleanly. */
  async markPublished(
    id: string,
    input: {
      regressionResult: Record<string, unknown>;
      previousPrompt: Record<string, unknown>;
      publishResult: Record<string, unknown>;
      reviewedByUserId: string;
    },
  ): Promise<Result<PromptSuggestion>> {
    const { data, error } = await this.client
      .from("prompt_suggestions")
      .update({
        status: "published",
        regression_result: input.regressionResult,
        previous_prompt: input.previousPrompt,
        publish_result: input.publishResult,
        reviewed_by_user_id: input.reviewedByUserId,
        reviewed_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending")
      .select("*")
      .single();
    if (error) {
      if (isNoRowsMatchedError(error)) {
        return err(AppError.conflict("Prompt suggestion was already reviewed by someone else"));
      }
      return err(AppError.externalProvider("Failed to mark prompt suggestion published", error));
    }
    return ok(mapPromptSuggestionRow(data));
  }
}
