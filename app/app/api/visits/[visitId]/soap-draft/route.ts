import {
  createOpenAiSoapNoteProvider,
  createStubSoapNoteProvider,
} from "@/lib/ai/soap-note/provider";
import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { AppError } from "@/lib/errors/app-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { soapDraftFromRecordingSchema } from "@/lib/validators/ai-summary";

const SOAP_RECORDINGS_BUCKET = "soap-recordings";

type Params = { params: Promise<{ visitId: string }> };

/**
 * Resolves the SOAP-note provider the same way the provider module's own
 * `transcribeAndParseSoapNote`/`parseSoapNoteTranscript` helpers do: the
 * deterministic stub under test/vitest (no network, no OPENAI_API_KEY
 * needed), the real OpenAI-backed provider otherwise.
 */
function resolveSoapNoteProvider() {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test"
    ? createStubSoapNoteProvider()
    : createOpenAiSoapNoteProvider();
}

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { visitId } = await params;
    const { actor, visit, aiArtifact } = await getActorAndServices();

    const visitResult = await visit.getVisitById(actor, visitId);
    if (!visitResult.ok) return handleRouteError(visitResult.error, requestId);

    const body = parseOrThrow(soapDraftFromRecordingSchema, await request.json());
    const { storagePath } = body;

    // Critical security check — the admin client below bypasses RLS
    // entirely, so this in-application check is the only thing preventing
    // one clinic's staff from reading another clinic's recording. It MUST
    // run before any Storage download.
    const clinicSegment = storagePath.split("/")[0];
    if (!clinicSegment || !actor.clinicIds.includes(clinicSegment)) {
      throw AppError.forbidden("Cannot access recording outside actor clinics");
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.storage
      .from(SOAP_RECORDINGS_BUCKET)
      .download(storagePath);

    if (error || !data) {
      throw AppError.externalProvider("Failed to download SOAP recording", error);
    }

    const audioBytes = new Uint8Array(await data.arrayBuffer());

    // Transcription errors (e.g. missing OPENAI_API_KEY, provider failure)
    // are intentionally not swallowed — they propagate to handleRouteError.
    const provider = resolveSoapNoteProvider();
    const { transcriptText } = await provider.transcribeAudio(audioBytes, "audio/webm");

    // sourceId must always be the visit's id: it's what makes the service's
    // per-(sourceId, "soap_note_generated") rate limiting actually apply.
    const artifactResult = await aiArtifact.generateArtifact(actor, "draft_soap", {
      clinicId: visitResult.value.clinicId,
      sourceType: "visit",
      sourceId: visitId,
      sourceText: transcriptText,
    });
    if (!artifactResult.ok) return handleRouteError(artifactResult.error, requestId);

    return jsonSuccess(
      {
        id: artifactResult.value.id,
        structuredPayload: artifactResult.value.structuredPayload,
        transcriptText,
      },
      201,
      requestId,
    );
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
