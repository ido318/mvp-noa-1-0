import { NextResponse } from "next/server";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { AppError } from "@/lib/errors/app-error";
import { getTwilioVoiceConfig } from "@/lib/integrations/twilio/config";
import { validateTwilioSignature } from "@/lib/integrations/twilio/signature";
import { createAdminVoiceServices } from "@/lib/services/factory";
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

async function handleTwilioVoiceWebhook(
  request: Request,
  handler: (
    services: ReturnType<typeof createAdminVoiceServices>,
    params: ReturnType<typeof twilioVoiceWebhookSchema.parse>,
  ) => Promise<Response>,
) {
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
    return await handler(services, params);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function POST(request: Request) {
  return handleTwilioVoiceWebhook(request, async (services, params) => {
    const result = await services.twilioVoiceWebhook.handleInbound(params);
    if (!result.ok) return handleRouteError(result.error);

    return new NextResponse(result.value.twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    });
  });
}
