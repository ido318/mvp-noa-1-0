import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import type { PromptSuggestion } from "@/types/domain/prompt-suggestion";

function messageFor(suggestion: PromptSuggestion): string {
  switch (suggestion.status) {
    case "published":
      return "Regression tests passed — the new prompt was published to the live agent.";
    case "failed_regression":
      return "One or more regression tests failed. The prompt was not published; see regressionResult.";
    case "pending":
      return "Could not confidently determine pass/fail from the ElevenLabs response. The prompt was not published; see regressionResult for the raw response.";
    default:
      return "";
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = createRequestId();

  try {
    const { actor, promptSuggestion } = await getActorAndServices();
    const { id } = await params;
    const result = await promptSuggestion.approve(actor, id);
    if (!result.ok) return handleRouteError(result.error, requestId);

    return jsonSuccess(
      {
        suggestion: result.value,
        published: result.value.status === "published",
        message: messageFor(result.value),
      },
      200,
      requestId,
    );
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
