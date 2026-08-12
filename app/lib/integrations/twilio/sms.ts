import { AppError } from "@/lib/errors/app-error";
import { getTwilioVoiceConfig } from "@/lib/integrations/twilio/config";

/** Convert an Israeli or raw phone string to E.164 (+972...). */
export function toE164Israel(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("972")) return `+${digits}`;
  if (digits.startsWith("0")) return `+972${digits.slice(1)}`;
  return `+${digits}`;
}

export type SendSmsResult = { sid: string | null };

/**
 * Send an SMS via the Twilio REST API using the clinic's configured credentials.
 * Reuses the same env-backed config as the voice integration; throws an AppError
 * when Twilio is not configured or the request fails.
 */
export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
  const config = getTwilioVoiceConfig();
  if (!config) {
    throw AppError.serviceUnavailable("Twilio is not configured (missing SMS credentials)");
  }

  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
  const params = new URLSearchParams({
    To: toE164Israel(to),
    From: config.clinicPhoneNumber,
    Body: body,
  });

  let response: Response;
  try {
    response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );
  } catch (error) {
    throw AppError.externalProvider("Failed to reach Twilio", error);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw AppError.externalProvider(`Twilio SMS send failed (${response.status})`, detail);
  }

  const payload = (await response.json().catch(() => ({}))) as { sid?: string };
  return { sid: payload.sid ?? null };
}
