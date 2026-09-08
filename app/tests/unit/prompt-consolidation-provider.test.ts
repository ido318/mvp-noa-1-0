import { afterEach, describe, expect, it } from "vitest";
import {
  createStubPromptConsolidationProvider,
  getPromptConsolidationModelName,
  isOpenAiConfigured,
} from "@/lib/ai/prompt-consolidation/provider";

describe("prompt-consolidation provider", () => {
  const originalEnv = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AI_PROMPT_MERGE_MODEL: process.env.AI_PROMPT_MERGE_MODEL,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  describe("isOpenAiConfigured", () => {
    it("returns false when OPENAI_API_KEY is unset or blank", () => {
      delete process.env.OPENAI_API_KEY;
      expect(isOpenAiConfigured()).toBe(false);
      process.env.OPENAI_API_KEY = "   ";
      expect(isOpenAiConfigured()).toBe(false);
    });

    it("returns true when OPENAI_API_KEY is set", () => {
      process.env.OPENAI_API_KEY = "sk-test-123";
      expect(isOpenAiConfigured()).toBe(true);
    });
  });

  describe("getPromptConsolidationModelName", () => {
    it("defaults to gpt-4o-mini when unset", () => {
      delete process.env.AI_PROMPT_MERGE_MODEL;
      expect(getPromptConsolidationModelName()).toBe("gpt-4o-mini");
    });

    it("uses the env override when set", () => {
      process.env.AI_PROMPT_MERGE_MODEL = "gpt-4o";
      expect(getPromptConsolidationModelName()).toBe("gpt-4o");
    });
  });

  describe("createStubPromptConsolidationProvider", () => {
    it("returns the given fixed mergedPrompt/summary", async () => {
      const provider = createStubPromptConsolidationProvider("merged text", "summary text");
      const result = await provider.consolidate({ livePrompt: "live", suggestions: [] });
      expect(result).toEqual({ mergedPrompt: "merged text", summary: "summary text" });
    });

    it("has sensible defaults when called with no args", async () => {
      const provider = createStubPromptConsolidationProvider();
      const result = await provider.consolidate({ livePrompt: "live", suggestions: [] });
      expect(result.mergedPrompt).toBeTruthy();
      expect(result.summary).toBeTruthy();
    });
  });
});
