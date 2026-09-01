import { randomUUID } from "crypto";
import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors/app-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const SOAP_RECORDINGS_BUCKET = "soap-recordings";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour, mirrors call-recordings

type Params = { params: Promise<{ visitId: string }> };

/**
 * Uploads a dictation recording for a visit's Voice SOAP draft.
 * Path shape: {clinic_id}/{visit_id}/{uuid}.webm — the clinic_id and
 * visit_id segments are always derived from the verified visit record,
 * never trusted from the request, so a caller cannot write into another
 * clinic's or visit's folder.
 */
export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { visitId } = await params;
    const { actor, visit } = await getActorAndServices();

    const visitResult = await visit.getVisitById(actor, visitId);
    if (!visitResult.ok) return handleRouteError(visitResult.error, requestId);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof Blob)) {
      throw AppError.validation("An audio file field named 'file' is required");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const storagePath = `${visitResult.value.clinicId}/${visitId}/${randomUUID()}.webm`;

    // Private bucket — upload via the admin/service-role client, bypassing
    // RLS by design (same convention as the call-recordings upload flow).
    const admin = createSupabaseAdminClient();
    const { error } = await admin.storage
      .from(SOAP_RECORDINGS_BUCKET)
      .upload(storagePath, bytes, {
        contentType: file.type || "audio/webm",
        upsert: false,
      });

    if (error) {
      throw AppError.externalProvider("Failed to upload SOAP recording", error);
    }

    return jsonSuccess({ storagePath }, 201, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

/**
 * Returns a short-lived signed URL for playback of a previously uploaded
 * recording. The admin client bypasses RLS entirely, so the clinic-segment
 * check below (against `actor.clinicIds`) is the only thing preventing one
 * clinic's staff from reading another clinic's recording by supplying an
 * arbitrary storagePath — it MUST run before any Storage call.
 */
export async function GET(request: Request, _: Params) {
  const requestId = createRequestId();

  try {
    const { actor } = await getActorAndServices();

    const url = new URL(request.url);
    const storagePath = url.searchParams.get("path");
    if (!storagePath) {
      throw AppError.validation("Query parameter 'path' is required");
    }

    const clinicSegment = storagePath.split("/")[0];
    if (!clinicSegment || !actor.clinicIds.includes(clinicSegment)) {
      throw AppError.forbidden("Cannot access recording outside actor clinics");
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.storage
      .from(SOAP_RECORDINGS_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      throw AppError.externalProvider("Failed to generate signed URL", error);
    }

    return jsonSuccess({ url: data.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
