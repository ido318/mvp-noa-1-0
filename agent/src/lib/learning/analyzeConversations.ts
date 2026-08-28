import { getSupabase } from "../supabase.js";
import { getEnv } from "../env.js";
import { logger } from "../logger.js";

const MIN_FLAGGED_CALLS = 2;
const LOOKBACK_DAYS = 7;
const ANTHROPIC_MODEL = "claude-sonnet-5";

type FlaggedCallReview = {
  id: string;
  elevenlabs_conversation_id: string;
  evaluation_results: Record<string, { result?: string; rationale?: string }>;
  flagged_criteria: string[];
};

type VoiceCallSummary = {
  elevenlabs_conversation_id: string | null;
  ai_summary: string | null;
};

export type AnalyzeConversationsResult = {
  ranAnalysis: boolean;
  flaggedCallCount: number;
  suggestionId?: string;
};

/**
 * Weekly job: pulls flagged call_reviews from the last 7 days, asks Claude to
 * identify a recurring pattern and propose a prompt patch, writes one pending
 * prompt_suggestions row. No-ops below MIN_FLAGGED_CALLS so a single bad call
 * never triggers a prompt change proposal.
 */
export async function analyzeConversations(clinicId: string): Promise<AnalyzeConversationsResult> {
  const env = getEnv();
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: flaggedReviews, error: reviewsErr } = await getSupabase()
    .from("call_reviews")
    .select("id, elevenlabs_conversation_id, evaluation_results, flagged_criteria")
    .eq("clinic_id", clinicId)
    .eq("flagged", true)
    .gte("created_at", since);

  if (reviewsErr) throw new Error(`analyzeConversations: call_reviews query failed: ${reviewsErr.message}`);

  const reviews = (flaggedReviews ?? []) as FlaggedCallReview[];
  if (reviews.length < MIN_FLAGGED_CALLS) {
    logger.info(
      { clinicId, flaggedCount: reviews.length },
      "analyzeConversations: below minimum flagged-call threshold, no-op",
    );
    return { ranAnalysis: false, flaggedCallCount: reviews.length };
  }

  const conversationIds = reviews.map((r) => r.elevenlabs_conversation_id);
  const { data: voiceCalls, error: callsErr } = await getSupabase()
    .from("voice_calls")
    .select("elevenlabs_conversation_id, ai_summary")
    .in("elevenlabs_conversation_id", conversationIds);

  if (callsErr) throw new Error(`analyzeConversations: voice_calls query failed: ${callsErr.message}`);

  const summaryByConversationId = new Map(
    ((voiceCalls ?? []) as VoiceCallSummary[]).map((c) => [c.elevenlabs_conversation_id, c.ai_summary]),
  );

  const casesForPrompt = reviews.map((r) => ({
    failed_criteria: r.flagged_criteria,
    rationale: r.flagged_criteria
      .map((id) => r.evaluation_results[id]?.rationale)
      .filter((v): v is string => Boolean(v)),
    call_summary: summaryByConversationId.get(r.elevenlabs_conversation_id) ?? null,
  }));

  const suggestion = await requestPromptSuggestion(env.ANTHROPIC_API_KEY, casesForPrompt);

  const { data: inserted, error: insertErr } = await getSupabase()
    .from("prompt_suggestions")
    .insert({
      clinic_id: clinicId,
      status: "pending",
      pattern_summary: suggestion.pattern_summary,
      suggested_prompt: suggestion.suggested_prompt,
      supporting_call_review_ids: reviews.map((r) => r.id),
    })
    .select("id")
    .single();

  if (insertErr) throw new Error(`analyzeConversations: prompt_suggestions insert failed: ${insertErr.message}`);

  logger.info(
    { clinicId, flaggedCount: reviews.length, suggestionId: inserted.id },
    "analyzeConversations: created pending prompt suggestion",
  );

  return { ranAnalysis: true, flaggedCallCount: reviews.length, suggestionId: inserted.id as string };
}

type PromptSuggestionDraft = { pattern_summary: string; suggested_prompt: string };

async function requestPromptSuggestion(
  apiKey: string,
  cases: Array<{ failed_criteria: string[]; rationale: string[]; call_summary: string | null }>,
): Promise<PromptSuggestionDraft> {
  const systemPrompt =
    "אתה עוזר שמנתח שיחות בעייתיות של סוכן קולי וטרינרי בשם תומר (עברית) ומציע תיקון קונקרטי לפרומפט המערכת שלו. " +
    "קבל רשימת מקרים שנכשלו בקריטריוני הערכה, זהה דפוס חוזר, והצע פרומפט מערכת מתוקן מלא. " +
    'החזר אך ורק JSON תקני בצורה: {"pattern_summary": "...", "suggested_prompt": "..."} ללא טקסט נוסף.';

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: JSON.stringify({ flagged_cases: cases }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Anthropic API request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Anthropic API returned no text content");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownJsonFence(text));
  } catch {
    throw new Error(`Anthropic API returned non-JSON content: ${text.slice(0, 200)}`);
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>)["pattern_summary"] !== "string" ||
    typeof (parsed as Record<string, unknown>)["suggested_prompt"] !== "string"
  ) {
    throw new Error("Anthropic API JSON missing required fields");
  }

  return parsed as PromptSuggestionDraft;
}

/** Claude sometimes wraps requested-JSON-only output in a ```json fence despite instructions. */
function stripMarkdownJsonFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced?.[1] ?? trimmed;
}
