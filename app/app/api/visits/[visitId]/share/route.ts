import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";

type Params = { params: Promise<{ visitId: string }> };

function resolveOrigin(request: Request): string | undefined {
  const host = request.headers.get("host");
  if (!host) return undefined;
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, visitShare } = await getActorAndServices();
    const { visitId } = await params;
    const result = await visitShare.createAndSend(actor, visitId, {
      origin: resolveOrigin(request),
    });
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 201, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
