import { Hono } from "hono";
import { z } from "zod";
import { logger, maskPhone } from "../../lib/logger.js";
import { getEnv } from "../../lib/env.js";
import { verifyElevenLabsSignature } from "../../lib/elevenLabsAuth.js";
import { findCustomerByPhone, addEscalation } from "../../lib/store.js";

export const toolsRoutes = new Hono();

// All /tools/* routes require a valid ElevenLabs signature.
// Hono caches the body after the first read, so route handlers can still call c.req.json().
toolsRoutes.use("/tools/*", async (c, next) => {
  const env = getEnv();
  const rawBody = await c.req.text();
  const sigHeader = c.req.header("elevenlabs-signature") ?? "";

  if (!verifyElevenLabsSignature(rawBody, sigHeader, env.ELEVENLABS_WEBHOOK_SECRET)) {
    logger.warn({ path: c.req.path }, "tools: invalid ElevenLabs signature");
    return c.json({ error: "forbidden" }, 403);
  }

  return next();
});

// POST /tools/lookup-customer
const lookupSchema = z.object({ phone: z.string().min(5) });

toolsRoutes.post("/tools/lookup-customer", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = lookupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ result: "פרמטר phone חסר או שגוי." }, 400);
  }

  logger.info({ phone: maskPhone(parsed.data.phone) }, "tool: lookup-customer");

  const customer = await findCustomerByPhone(parsed.data.phone);

  if (!customer) {
    return c.json({ result: "לקוח לא מוכר. אסוף פרטים בעצמך." });
  }

  const petList = customer.pets.map((p) => p.name).join(", ");
  return c.json({
    // TODO: add last_visit once it is derived from the appointments table
    result: `שם: ${customer.full_name}, חיות: ${petList}`,
  });
});

// POST /tools/escalate-to-noa
const escalateSchema = z.object({
  reason: z.string().min(1),
  urgency: z.number().int().min(1).max(10),
});

toolsRoutes.post("/tools/escalate-to-noa", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = escalateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ result: "פרמטרים חסרים: reason, urgency (1-10)." }, 400);
  }

  const { reason, urgency } = parsed.data;

  if (urgency >= 7) {
    logger.warn({ urgency, reason }, "tool: escalate-to-noa — HIGH URGENCY");
  } else {
    logger.info({ urgency, reason }, "tool: escalate-to-noa");
  }

  await addEscalation({ reason, urgency });

  return c.json({ result: `הועברה לנועה (urgency: ${urgency}/10)` });
});
