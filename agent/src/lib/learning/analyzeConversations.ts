import { getSupabase } from "../supabase.js";
import { getEnv } from "../env.js";
import { logger } from "../logger.js";
import { callClaudeForJson } from "./claudeJson.js";

const MIN_FLAGGED_CALLS = 2;
const LOOKBACK_DAYS = 7;

type FlaggedCallReview = {
  id: string;
  evaluation_criteria_results: Record<string, { result?: string; rationale?: string }>;
  flagged_reasons: string[];
  transcript_summary: string | null;
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
    .select("id, evaluation_criteria_results, flagged_reasons, transcript_summary")
    .eq("clinic_id", clinicId)
    .eq("is_exception", true)
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

  const casesForPrompt = reviews.map((r) => ({
    failed_criteria: r.flagged_reasons,
    rationale: r.flagged_reasons
      .map((id) => r.evaluation_criteria_results[id]?.rationale)
      .filter((v): v is string => Boolean(v)),
    call_summary: r.transcript_summary,
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

  const parsed = await callClaudeForJson(apiKey, systemPrompt, { flagged_cases: cases });

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
