import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";

export async function GET(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, escalation } = await getActorAndServices();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as "open" | "resolved" | null;

    const result = await escalation.listForClinics(
      actor.clinicIds,
      status ?? undefined,
    );
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ items: result.value }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
