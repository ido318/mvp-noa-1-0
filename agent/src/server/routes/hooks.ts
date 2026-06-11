import { Hono } from "hono";
import { getEnv } from "../../lib/env.js";
import { logger } from "../../lib/logger.js";
import { verifyElevenLabsSignature } from "../../lib/elevenLabsAuth.js";
import { saveVoiceCall } from "../../lib/store.js";

export const hooksRoutes = new Hono();

// POST /hooks/call-ended
hooksRoutes.post("/hooks/call-ended", async (c) => {
  const env = getEnv();
  const rawBody = await c.req.text();
  const sigHeader = c.req.header("elevenlabs-signature") ?? "";

  if (!verifyElevenLabsSignature(rawBody, sigHeader, env.ELEVENLABS_WEBHOOK_SECRET)) {
    logger.warn("hooks: call-ended signature invalid");
    return c.json({ error: "invalid_signature" }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const conversationId =
    (payload["conversation_id"] as string | undefined) ?? `unknown-${Date.now()}`;
  const rawDuration = payload["duration_seconds"] ?? payload["duration"] ?? null;
  const durationSec = typeof rawDuration === "number" ? rawDuration : null;
  const success =
    typeof payload["success"] === "boolean" ? payload["success"] : null;

  logger.info({ conversationId, durationSec, success }, "hook: call ended");

  await saveVoiceCall(conversationId, durationSec, success, payload);

  return c.json({ ok: true });
});
