import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { createAdminServices } from "@/lib/services/factory";

export async function GET() {
  const requestId = createRequestId();

  try {
    const { health } = createAdminServices();
    const result = await health.check();

    if (!result.ok) {
      return handleRouteError(result.error, requestId);
    }

    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
