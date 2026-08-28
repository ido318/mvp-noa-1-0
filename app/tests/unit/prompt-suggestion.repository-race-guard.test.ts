import { describe, expect, it, vi } from "vitest";
import { PromptSuggestionRepository } from "@/lib/repositories/prompt-suggestion.repository";

function buildQuery(result: { data: unknown; error: unknown }) {
  const query = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
  return query;
}

const suggestionRow = {
  id: "sugg-1",
  clinic_id: "clinic-1",
  status: "rejected",
  pattern_summary: "x",
  suggested_prompt: "y",
  supporting_call_review_ids: [],
  regression_result: null,
  previous_prompt: null,
  publish_result: null,
  reviewed_by_user_id: "user-1",
  reviewed_at: "2026-08-28T00:00:00.000Z",
  published_at: null,
  created_at: "2026-08-27T00:00:00.000Z",
};

describe("PromptSuggestionRepository write guards", () => {
  it("markRejected scopes the update to status='pending' (compare-and-set)", async () => {
    const query = buildQuery({ data: suggestionRow, error: null });
    const client = { from: vi.fn().mockReturnValue(query) };
    const repo = new PromptSuggestionRepository(client as never);

    const result = await repo.markRejected("sugg-1", "user-1");

    expect(result.ok).toBe(true);
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", "sugg-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "status", "pending");
  });

  it("markRejected returns a 409 conflict when a concurrent review already claimed the row", async () => {
    const query = buildQuery({ data: null, error: { code: "PGRST116", message: "no rows" } });
    const client = { from: vi.fn().mockReturnValue(query) };
    const repo = new PromptSuggestionRepository(client as never);

    const result = await repo.markRejected("sugg-1", "user-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(409);
  });

  it("markPublished returns a 409 conflict when a concurrent review already claimed the row", async () => {
    const query = buildQuery({ data: null, error: { code: "PGRST116", message: "no rows" } });
    const client = { from: vi.fn().mockReturnValue(query) };
    const repo = new PromptSuggestionRepository(client as never);

    const result = await repo.markPublished("sugg-1", {
      regressionResult: {},
      previousPrompt: {},
      publishResult: {},
      reviewedByUserId: "user-1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(409);
  });

  it("recordRegressionResult returns a 409 conflict when a concurrent review already claimed the row", async () => {
    const query = buildQuery({ data: null, error: { code: "PGRST116", message: "no rows" } });
    const client = { from: vi.fn().mockReturnValue(query) };
    const repo = new PromptSuggestionRepository(client as never);

    const result = await repo.recordRegressionResult("sugg-1", {
      status: "failed_regression",
      regressionResult: {},
      reviewedByUserId: "user-1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(409);
  });

  it("a non-race Supabase error still maps to a generic external-provider error, not a conflict", async () => {
    const query = buildQuery({ data: null, error: { code: "500", message: "db down" } });
    const client = { from: vi.fn().mockReturnValue(query) };
    const repo = new PromptSuggestionRepository(client as never);

    const result = await repo.markRejected("sugg-1", "user-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(502);
  });
});
