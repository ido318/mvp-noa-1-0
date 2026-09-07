import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { getSystemPrompt, getUserPrompt } from "@/lib/ai/prompt-consolidation/prompt";
import type {
  ConsolidationInput,
  ConsolidationResult,
  PromptConsolidationProvider,
} from "@/lib/ai/prompt-consolidation/types";

export function getPromptConsolidationModelName(): string {
  return process.env.AI_PROMPT_MERGE_MODEL ?? "gpt-4o-mini";
}

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function extractTag(text: string, tag: string): string {
  const match = text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!match || match[1] === undefined) {
    throw new Error(`Model response is missing the <${tag}> tag`);
  }
  return match[1].trim();
}

export function createOpenAiPromptConsolidationProvider(): PromptConsolidationProvider {
  return {
    async consolidate(input: ConsolidationInput): Promise<ConsolidationResult> {
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not configured");
      }

      const modelName = getPromptConsolidationModelName();
      const openai = createOpenAI({ apiKey });

      const { text } = await generateText({
        model: openai(modelName),
        system: getSystemPrompt(),
        prompt: getUserPrompt(input.livePrompt, input.suggestions),
        maxOutputTokens: 4000,
      });

      return {
        mergedPrompt: extractTag(text, "merged_prompt"),
        summary: extractTag(text, "summary"),
      };
    },
  };
}

export function createStubPromptConsolidationProvider(
  mergedPrompt = "פרומפט מאוחד לבדיקה",
  summary = "תקציר איחוד לבדיקה",
): PromptConsolidationProvider {
  return {
    async consolidate(): Promise<ConsolidationResult> {
      return { mergedPrompt, summary };
    },
  };
}

export async function consolidatePromptSuggestions(
  input: ConsolidationInput,
  provider?: PromptConsolidationProvider,
): Promise<ConsolidationResult> {
  const resolved =
    provider ??
    (process.env.VITEST === "true" || process.env.NODE_ENV === "test"
      ? createStubPromptConsolidationProvider()
      : createOpenAiPromptConsolidationProvider());

  return resolved.consolidate(input);
}
