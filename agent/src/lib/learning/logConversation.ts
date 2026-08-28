import { getSupabase } from "../supabase.js";
import { logger } from "../logger.js";

type EvaluationCriterionResult = {
  result?: "success" | "failure" | "unknown";
  rationale?: string;
};

/**
 * Reads ElevenLabs' `analysis.evaluation_criteria_results` from an already-parsed
 * /hooks/call-ended payload and logs it to call_reviews. Never throws — a failure
 * here must not affect the webhook response (call the site with `.catch()`).
 */
export async function logConversation(
  conversationId: string,
  clinicId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const analysis = payload["analysis"] as Record<string, unknown> | undefined;
  const evaluationResults =
    (analysis?.["evaluation_criteria_results"] as
      | Record<string, EvaluationCriterionResult>
      | undefined) ?? {};

  const flaggedCriteria = Object.entries(evaluationResults)
    .filter(([, criterion]) => criterion.result === "failure")
    .map(([criteriaId]) => criteriaId);

  const { error } = await getSupabase().from("call_reviews").upsert(
    {
      clinic_id: clinicId,
      elevenlabs_conversation_id: conversationId,
      evaluation_results: evaluationResults,
      flagged: flaggedCriteria.length > 0,
      flagged_criteria: flaggedCriteria,
    },
    { onConflict: "elevenlabs_conversation_id" },
  );

  if (error) {
    logger.error({ err: error, conversationId }, "logConversation: call_reviews upsert failed");
  }
}
