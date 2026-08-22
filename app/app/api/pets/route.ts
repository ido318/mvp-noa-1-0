import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { z } from "zod";

const listPetsSchema = z.object({
  customerId: z.string().uuid().optional(),
  query: z.string().trim().max(100).optional(),
});

export async function GET(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, pet } = await getActorAndServices();
    const { searchParams } = new URL(request.url);
    const parsed = parseOrThrow(listPetsSchema, {
      customerId: searchParams.get("customerId") ?? undefined,
      query: searchParams.get("query") ?? undefined,
    });

    const result = await pet.listPets(actor, parsed.customerId, parsed.query);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ items: result.value }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
