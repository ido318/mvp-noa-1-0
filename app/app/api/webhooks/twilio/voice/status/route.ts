import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { getTwilioVoiceConfig } from "@/lib/integrations/twilio/config";
import { validateTwilioSignature } from "@/lib/integrations/twilio/signature";
import { createAdminVoiceServices } from "@/lib/services/factory";
import { parseOrThrow } from "@/lib/api/validation";
import { AppError } from "@/lib/errors/app-error";
import { twilioVoiceWebhookSchema } from "@/lib/validators/voice-call";

function getWebhookUrl(request: Request): string {
  const config = getTwilioVoiceConfig();
  const url = new URL(request.url);
  if (config) {
    return `${config.baseUrl}${url.pathname}${url.search}`;
  }
  return request.url;
}

async function parseTwilioForm(request: Request): Promise<Record<string, string>> {
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === "string") {
      params[key] = value;
    }
  });
  return params;
}

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    const config = getTwilioVoiceConfig();
    if (!config) {
      throw AppError.internal("Twilio voice is not configured");
    }

    const rawParams = await parseTwilioForm(request);
    const signature = request.headers.get("X-Twilio-Signature");
    const webhookUrl = getWebhookUrl(request);

    if (!validateTwilioSignature(config.authToken, signature, webhookUrl, rawParams)) {
      throw AppError.forbidden("Invalid Twilio signature");
    }

    const params = parseOrThrow(twilioVoiceWebhookSchema, rawParams);
    const services = createAdminVoiceServices();
    const result = await services.twilioVoiceWebhook.handleStatus(params);
    if (!result.ok) return handleRouteError(result.error, requestId);

    return jsonSuccess({ ok: true }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
