import { Hono } from "hono";
import { z } from "zod";
import { logger, maskPhone } from "../../lib/logger.js";
import { getEnv } from "../../lib/env.js";
import { verifyElevenLabsSignature } from "../../lib/elevenLabsAuth.js";
import { findCustomerByPhone, addEscalation } from "../../lib/store.js";
import { triagePetCase } from "../../triage/triageDecision.js";

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

// POST /tools/triage-pet-case
const triageSchema = z.object({
  symptoms_he: z.string().min(1),
  duration_he: z.string().optional(),
  pet_type: z.enum(["כלב", "חתול", "אחר"]),
  pet_age_years: z.number().positive().optional(),
  pet_weight_kg: z.number().positive().optional(),
  additional_signs_he: z.array(z.string()).optional(),
});

toolsRoutes.post("/tools/triage-pet-case", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = triageSchema.safeParse(body);
  if (!parsed.success) {
    logger.warn({ errors: parsed.error.issues }, "tool: triage-pet-case — validation failed");
    return c.json({ result: "פרמטרים חסרים: symptoms_he, pet_type." }, 400);
  }

  const input = parsed.data;
  logger.info({ pet_type: input.pet_type }, "tool: triage-pet-case");

  const result = triagePetCase(input);

  logger.info(
    {
      decision: result.decision,
      urgency_score: result.urgency_score,
      red_flags: result.red_flags_matched,
    },
    "tool: triage-pet-case — result",
  );

  return c.json(result);
});
