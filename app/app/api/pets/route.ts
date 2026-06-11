import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";

export async function GET(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, pet } = await getActorAndServices();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId") ?? undefined;
    const query = searchParams.get("query") ?? undefined;

    const result = await pet.listPets(actor, customerId, query);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ items: result.value }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
