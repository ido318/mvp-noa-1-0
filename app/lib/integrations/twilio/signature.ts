import twilio from "twilio";

export function validateTwilioSignature(
  authToken: string,
  signature: string | null,
  url: string,
  params: Record<string, string>,
): boolean {
  if (!signature) return false;
  return twilio.validateRequest(authToken, signature, url, params);
}

export function mapTwilioCallStatus(status: string | undefined): import("@/types/domain/voice-call").VoiceCallStatus {
  switch ((status ?? "").toLowerCase()) {
    case "queued":
      return "queued";
    case "ringing":
      return "ringing";
    case "in-progress":
      return "in_progress";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "busy":
      return "busy";
    case "no-answer":
      return "no_answer";
    case "canceled":
      return "canceled";
    default:
      return "in_progress";
  }
}

export function sanitizeTwilioMetadata(
  params: Record<string, string>,
): Record<string, unknown> {
  return {
    callStatus: params.CallStatus ?? null,
    direction: params.Direction ?? null,
    digits: params.Digits ?? null,
    parentCallSid: params.ParentCallSid ?? null,
  };
}
