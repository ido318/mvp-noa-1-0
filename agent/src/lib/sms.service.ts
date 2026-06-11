import twilio from "twilio";
import { getEnv } from "./env.js";
import { normalisePhone } from "./store.js";

let _client: ReturnType<typeof twilio> | null = null;

function getTwilioClient() {
  if (!_client) {
    const env = getEnv();
    _client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }
  return _client;
}

export async function sendSms(to: string, body: string): Promise<{ sid: string }> {
  const env = getEnv();
  const normalisedTo = normalisePhone(to);
  const message = await getTwilioClient().messages.create({
    body,
    from: env.TWILIO_PHONE_NUMBER,
    to: normalisedTo,
  });
  return { sid: message.sid };
}
