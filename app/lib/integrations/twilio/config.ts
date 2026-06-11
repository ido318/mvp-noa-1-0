/** Default seeded clinic when TWILIO maps to single-clinic MVP */
export const DEFAULT_VOICE_CLINIC_ID = "00000000-0000-4000-8000-000000000001";

export type TwilioVoiceConfig = {
  accountSid: string;
  authToken: string;
  clinicPhoneNumber: string;
  clinicId: string;
  baseUrl: string;
};

export function getTwilioVoiceConfig(): TwilioVoiceConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const clinicPhoneNumber = process.env.TWILIO_CLINIC_PHONE_NUMBER?.trim();
  const baseUrl = process.env.APP_BASE_URL?.trim();

  if (!accountSid || !authToken || !clinicPhoneNumber || !baseUrl) {
    return null;
  }

  return {
    accountSid,
    authToken,
    clinicPhoneNumber,
    clinicId: process.env.TWILIO_CLINIC_ID?.trim() || DEFAULT_VOICE_CLINIC_ID,
    baseUrl: baseUrl.replace(/\/$/, ""),
  };
}

export function voiceWebhookUrl(path: string): string {
  const config = getTwilioVoiceConfig();
  if (!config) return path;
  return `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
