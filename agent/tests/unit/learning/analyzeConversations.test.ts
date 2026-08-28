import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ANTHROPIC_API_KEY default comes from tests/setup.ts (must be set before any
// module that calls getEnv() at import time — e.g. logger.ts — is evaluated).

const { mockFrom, callReviewsSelectResult, voiceCallsSelectResult, insertedSuggestion } = vi.hoisted(() => {
  const callReviewsSelectResult: { data: unknown[]; error: null } = { data: [], error: null };
  const voiceCallsSelectResult: { data: unknown[]; error: null } = { data: [], error: null };
  const insertedSuggestion = { id: "suggestion-1" };

  const mockFrom = vi.fn((table: string) => {
    if (table === "call_reviews") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              gte: () => Promise.resolve(callReviewsSelectResult),
            }),
          }),
        }),
      };
    }
    if (table === "voice_calls") {
      return {
        select: () => ({
          in: () => Promise.resolve(voiceCallsSelectResult),
        }),
      };
    }
    if (table === "prompt_suggestions") {
      return {
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: insertedSuggestion, error: null }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  return { mockFrom, callReviewsSelectResult, voiceCallsSelectResult, insertedSuggestion };
});

vi.mock("../../../src/lib/supabase.js", () => ({
  getSupabase: vi.fn(() => ({ from: mockFrom })),
}));

import { analyzeConversations } from "../../../src/lib/learning/analyzeConversations.js";

beforeEach(() => {
  mockFrom.mockClear();
  callReviewsSelectResult.data = [];
  voiceCallsSelectResult.data = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("analyzeConversations", () => {
  it("no-ops when fewer than 2 flagged calls exist", async () => {
    callReviewsSelectResult.data = [
      { id: "r1", elevenlabs_conversation_id: "conv_1", evaluation_results: {}, flagged_criteria: [] },
    ];

    const result = await analyzeConversations("clinic-1");

    expect(result).toEqual({ ranAnalysis: false, flaggedCallCount: 1 });
    expect(mockFrom).not.toHaveBeenCalledWith("prompt_suggestions");
  });

  it("no-ops on zero flagged calls", async () => {
    const result = await analyzeConversations("clinic-1");
    expect(result).toEqual({ ranAnalysis: false, flaggedCallCount: 0 });
  });

  it("throws a clear error when ANTHROPIC_API_KEY is not configured", async () => {
    vi.resetModules();
    const original = process.env["ANTHROPIC_API_KEY"];
    delete process.env["ANTHROPIC_API_KEY"];

    const { analyzeConversations: analyzeWithoutKey } = await import(
      "../../../src/lib/learning/analyzeConversations.js"
    );

    await expect(analyzeWithoutKey("clinic-1")).rejects.toThrow("ANTHROPIC_API_KEY");

    process.env["ANTHROPIC_API_KEY"] = original;
    vi.resetModules();
  });

  it("calls Claude and inserts a pending prompt_suggestions row when >= 2 flagged calls exist", async () => {
    callReviewsSelectResult.data = [
      {
        id: "r1",
        elevenlabs_conversation_id: "conv_1",
        evaluation_results: { no_forbidden_phrases: { result: "failure", rationale: "used forbidden phrase" } },
        flagged_criteria: ["no_forbidden_phrases"],
      },
      {
        id: "r2",
        elevenlabs_conversation_id: "conv_2",
        evaluation_results: { no_forbidden_phrases: { result: "failure", rationale: "used forbidden phrase again" } },
        flagged_criteria: ["no_forbidden_phrases"],
      },
    ];
    voiceCallsSelectResult.data = [
      { elevenlabs_conversation_id: "conv_1", ai_summary: "summary 1" },
      { elevenlabs_conversation_id: "conv_2", ai_summary: "summary 2" },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            content: [
              {
                type: "text",
                // Real Claude responses sometimes wrap JSON in a markdown fence
                // despite being asked for JSON only — regression test for that.
                text:
                  "```json\n" +
                  JSON.stringify({
                    pattern_summary: "תומר משתמש בביטוי אסור באופן חוזר",
                    suggested_prompt: "פרומפט מתוקן",
                  }) +
                  "\n```",
              },
            ],
          }),
      }),
    );

    const result = await analyzeConversations("clinic-1");

    expect(result).toEqual({
      ranAnalysis: true,
      flaggedCallCount: 2,
      suggestionId: insertedSuggestion.id,
    });
    expect(mockFrom).toHaveBeenCalledWith("prompt_suggestions");
  });

  it("throws when the Anthropic API request fails", async () => {
    callReviewsSelectResult.data = [
      { id: "r1", elevenlabs_conversation_id: "conv_1", evaluation_results: {}, flagged_criteria: ["x"] },
      { id: "r2", elevenlabs_conversation_id: "conv_2", evaluation_results: {}, flagged_criteria: ["x"] },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve("server error") }),
    );

    await expect(analyzeConversations("clinic-1")).rejects.toThrow("Anthropic API request failed");
  });
});
