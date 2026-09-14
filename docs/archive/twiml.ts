import { voiceWebhookUrl } from "@/lib/integrations/twilio/config";

const VOICE = "Polly.Lucia-Neural";
const LANG = "he-IL";

export function buildInitialInboundTwiml(): string {
  const action = voiceWebhookUrl("/api/webhooks/twilio/voice/inbound");
  const statusCallback = voiceWebhookUrl("/api/webhooks/twilio/voice/status");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response statusCallback="${escapeXml(statusCallback)}" statusCallbackMethod="POST">
  <Say voice="${VOICE}" language="${LANG}">שלום, הגעתם למרפאה הווטרינרית. שירות זה אינו מיועד למקרי חירום. לקביעת תור, לחצו 1. לבקשת שיחזור, לחצו 2.</Say>
  <Gather input="dtmf" numDigits="1" timeout="5" action="${escapeXml(action)}" method="POST">
    <Say voice="${VOICE}" language="${LANG}">לקביעת תור לחצו 1. לבקשת שיחזור לחצו 2.</Say>
  </Gather>
  <Say voice="${VOICE}" language="${LANG}">לא התקבלה בחירה. להתראות.</Say>
  <Hangup/>
</Response>`;
}

export function buildMenuResponseTwiml(digits: string): string {
  const statusCallback = voiceWebhookUrl("/api/webhooks/twilio/voice/status");

  if (digits === "1") {
    return wrapResponse(
      `<Say voice="${VOICE}" language="${LANG}">לקביעת תור, נציג יחזור אליכם בשעות הפעילות. תודה שפניתם אלינו.</Say><Hangup/>`,
      statusCallback,
    );
  }
  if (digits === "2") {
    return wrapResponse(
      `<Say voice="${VOICE}" language="${LANG}">קיבלנו את בקשתכם לשיחזור. ניצור קשר בהקדם האפשר.</Say><Hangup/>`,
      statusCallback,
    );
  }
  return wrapResponse(
    `<Say voice="${VOICE}" language="${LANG}">הבחירה אינה תקינה. להתראות.</Say><Hangup/>`,
    statusCallback,
  );
}

function wrapResponse(body: string, statusCallback: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response statusCallback="${escapeXml(statusCallback)}" statusCallbackMethod="POST">
  ${body}
</Response>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
