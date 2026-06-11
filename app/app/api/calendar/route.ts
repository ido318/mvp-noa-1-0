import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors/app-error";

export async function GET(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, calendar } = await getActorAndServices();
    const { searchParams } = new URL(request.url);
    const clinicId = searchParams.get("clinicId");
    const view = searchParams.get("view") ?? "day";
    const date = searchParams.get("date");

    if (!clinicId || !date) {
      throw AppError.validation("clinicId and date are required");
    }
    if (!actor.clinicIds.includes(clinicId)) {
      throw AppError.forbidden("Cannot access requested clinic");
    }

    if (view === "week") {
      const result = await calendar.listWeek(actor, clinicId, date);
      if (!result.ok) return handleRouteError(result.error, requestId);
      return jsonSuccess({ items: result.value, view: "week" }, 200, requestId);
    }

    const result = await calendar.listDay(actor, clinicId, date);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ items: result.value, view: "day" }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
