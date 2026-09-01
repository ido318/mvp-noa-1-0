import { Hono } from "hono";
import { z } from "zod";
import { logger, maskPhone } from "../../lib/logger.js";
import { getEnv } from "../../lib/env.js";
import { isValidBearerToken } from "../middleware/bearerAuth.js";
import {
  findCustomerByPhone,
  addEscalation,
  checkAvailability,
  bookAppointment,
  cancelAppointment,
  rescheduleAppointment,
  joinWaitlist,
} from "../../lib/store.js";
import {
  decideTriage,
  EMERGENCY_SCRIPT,
  URGENT_CALLBACK_SCRIPT,
  AFTER_HOURS_SCRIPT,
  ROUTINE_SCRIPT,
} from "../../services/triage.service.js";
import {
  decideConversationPolicy,
  formatConversationPolicyForVoice,
} from "../../services/conversation-policy.service.js";
import { decideHumanHandoff } from "../../services/handoff.service.js";

export const toolsRoutes = new Hono();

// All /tools/* routes require a Bearer token sent by ElevenLabs as a static request header.
// ElevenLabs ConvAI tool calls do not use HMAC signing — they use a pre-shared Bearer token
// configured in each tool's api_schema.request_headers (set by sync-elevenlabs-agent.ts).
toolsRoutes.use("/tools/*", async (c, next) => {
  const env = getEnv();
  if (!isValidBearerToken(c.req.header("authorization"), env.TOOLS_BEARER_TOKEN)) {
    logger.warn({ path: c.req.path }, "tools: unauthorized");
    return c.json({ error: "forbidden" }, 403);
  }

  return next();
});

// Shared visit type enum — mirrors public.appointment_type (Sprint 1 values)
const VISIT_TYPE_VALUES = [
  "checkup",
  "home_visit",
  "vaccination",
  "phone_consultation",
  "neutering",
  "consultation",
  "urgent",
  "follow_up",
  "other",
] as const;

// ISO8601 datetime — requires timezone (Z or ±HH:MM) to avoid ambiguous local times
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/;

// ─────────────────────────────────────────────────────────────────────────────
// POST /tools/conversation-policy
// ─────────────────────────────────────────────────────────────────────────────

const conversationPolicySchema = z.object({
  user_utterance_he: z.string().min(1),
  known_pet_type: z.enum(["כלב", "חתול", "אחר"]).optional(),
  known_symptoms_he: z.string().optional(),
  known_duration_he: z.string().optional(),
  red_flag_answers_he: z.array(z.string()).optional(),
  last_agent_action: z.string().optional(),
  repeated_turns: z.number().int().min(0).optional(),
});

toolsRoutes.post("/tools/conversation-policy", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = conversationPolicySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ result: "פרמטר חסר: user_utterance_he." }, 400);
  }

  const policy = decideConversationPolicy(parsed.data);
  return c.json({ result: formatConversationPolicyForVoice(policy) });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /tools/lookup-customer
// ─────────────────────────────────────────────────────────────────────────────

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

  const petList = customer.pets
    .map((p) => [p.name, p.species, p.breed].filter(Boolean).join(" - "))
    .join(", ");
  return c.json({
    result: `שם: ${customer.full_name}, חיות: ${petList}`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /tools/escalate-to-noa
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// POST /tools/request-human-handoff
// Transfers the live call to Noa's mobile during business hours; otherwise
// records an escalation. The actual PSTN transfer is executed by ElevenLabs
// using the returned `number` when `transfer` is true.
// ─────────────────────────────────────────────────────────────────────────────

const handoffSchema = z.object({
  reason: z.string().min(1).optional(),
  emergency: z.boolean().optional(),
});

toolsRoutes.post("/tools/request-human-handoff", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = handoffSchema.safeParse(body);
  const reason = parsed.success ? parsed.data.reason : undefined;
  const emergency = parsed.success ? parsed.data.emergency : undefined;

  const decision = decideHumanHandoff({
    now: new Date(),
    targetNumber: getEnv().HUMAN_HANDOFF_NUMBER,
    emergency,
  });

  if (decision.escalate) {
    await addEscalation({
      reason: reason ?? "בקשת מעבר לנציג אנושי",
      urgency: decision.urgency ?? 6,
    });
  }

  logger.info(
    { transfer: decision.transfer, escalate: decision.escalate },
    "tool: request-human-handoff",
  );

  return c.json({
    result: decision.result,
    transfer: decision.transfer,
    ...(decision.number ? { number: decision.number } : {}),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /tools/triage-pet-case
// ─────────────────────────────────────────────────────────────────────────────

const triageSchema = z.object({
  symptoms_he:        z.string().min(1),
  duration_he:        z.string().optional(),
  pet_type:           z.enum(["כלב", "חתול", "אחר"]),
  pet_age_years:      z.number().positive().optional(),
  pet_weight_kg:      z.number().positive().optional(),
  additional_signs_he: z.array(z.string()).optional(),
  customer_id:        z.string().uuid().optional(),
  pet_id:             z.string().uuid().optional(),
});

function todayIsraelIso(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

toolsRoutes.post("/tools/triage-pet-case", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = triageSchema.safeParse(body);
  if (!parsed.success) {
    logger.warn({ errors: parsed.error.issues }, "tool: triage-pet-case — validation failed");
    return c.json({ result: "פרמטרים חסרים: symptoms_he, pet_type." }, 400);
  }

  const input = parsed.data;
  const now = new Date();

  // Combine symptoms + duration hint for richer text matching
  const fullText = [
    input.symptoms_he,
    input.duration_he ?? "",
    ...(input.additional_signs_he ?? []),
  ].join(" ");

  const triage = decideTriage({ text: fullText, now });

  logger.info(
    {
      decision: triage.decision,
      urgency: triage.urgency,
      flags: triage.matchedFlags,
      within_hours: triage.withinBusinessHours,
    },
    "tool: triage-pet-case",
  );

  // ── Escalation (fire-and-forget) ──────────────────────────────────────────
  const shouldEscalate =
    triage.decision !== "routine" || triage.matchedFlags.length > 0;

  if (shouldEscalate) {
    const escalationUrgency =
      triage.decision === "urgent_callback"
        ? Math.max(4, triage.urgency)
        : triage.decision === "after_hours_referral"
          ? Math.min(triage.urgency, 5)  // low priority — info for morning
          : triage.urgency;

    void addEscalation({
      reason: `triage: ${triage.decision} — flags: ${triage.matchedFlags.join(", ") || "none"} — "${input.symptoms_he.slice(0, 120)}"`,
      urgency: escalationUrgency,
      notes: JSON.stringify({
        after_hours: !triage.withinBusinessHours,
        matched_flags: triage.matchedFlags,
        customer_id: input.customer_id ?? null,
        pet_id: input.pet_id ?? null,
      }),
    }).catch((err: unknown) =>
      logger.error({ err }, "triage-pet-case: escalation write failed"),
    );
  }

  // ── Build script ──────────────────────────────────────────────────────────
  let script: string;

  switch (triage.decision) {
    case "emergency_referral":
      script = EMERGENCY_SCRIPT;
      break;

    case "urgent_callback": {
      // Try to find a phone_consultation slot today
      let slotSuffix = "";
      try {
        const todayIso = todayIsraelIso(now);
        const availability = await checkAvailability(todayIso, "phone_consultation");
        // If the response contains a time pattern (HH:MM), slots are available
        const firstSlot = availability.match(/\b(\d{2}:\d{2})\b/)?.[1];
        if (firstSlot) {
          slotSuffix = ` מצאתי אפשרות לשיחה עם ד"ר נועה היום ב-${firstSlot} — לקבוע?`;
        }
      } catch {
        // slot lookup is best-effort; don't fail the triage call
      }
      script = URGENT_CALLBACK_SCRIPT + slotSuffix;
      break;
    }

    case "after_hours_referral":
      script = AFTER_HOURS_SCRIPT;
      break;

    default:
      script = ROUTINE_SCRIPT;
  }

  return c.json({ result: script });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /tools/check-availability
// ─────────────────────────────────────────────────────────────────────────────

const availabilitySchema = z.object({
  date_iso:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  visit_type: z.enum(VISIT_TYPE_VALUES),
});

toolsRoutes.post("/tools/check-availability", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = availabilitySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ result: "נדרש תאריך בפורמט YYYY-MM-DD וסוג ביקור (visit_type)." }, 400);
  }

  try {
    logger.info({ date: parsed.data.date_iso, visit_type: parsed.data.visit_type }, "tool: check-availability");
    const result = await checkAvailability(parsed.data.date_iso, parsed.data.visit_type);
    return c.json({ result });
  } catch (err) {
    logger.error({ err }, "tool: check-availability — internal error");
    return c.json({ result: "שגיאה פנימית בבדיקת זמינות. נסה שוב." }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /tools/book-appointment
// ─────────────────────────────────────────────────────────────────────────────

const bookSchema = z.object({
  phone:         z.string().min(5),
  customer_name: z.string().min(1),
  pet_name:      z.string().min(1),
  pet_species:   z.string().min(1),
  pet_breed:     z.string().min(1).optional().nullable(),
  scheduled_at:  z.string().regex(ISO_DATETIME_RE, "Expected ISO8601 datetime"),
  visit_type:    z.enum(VISIT_TYPE_VALUES),
  reason:        z.string().optional(),
  twilio_call_sid: z.string().min(1).optional(),
  elevenlabs_conversation_id: z.string().min(1).optional(),
});

toolsRoutes.post("/tools/book-appointment", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = bookSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({
      result: "פרמטרים חסרים: phone, customer_name, pet_name, pet_species, scheduled_at (ISO8601), visit_type.",
    }, 400);
  }

  try {
    logger.info({ phone: maskPhone(parsed.data.phone), visit_type: parsed.data.visit_type }, "tool: book-appointment");
    const result = await bookAppointment(parsed.data);
    return c.json({ result });
  } catch (err) {
    logger.error({ err }, "tool: book-appointment — internal error");
    return c.json({ result: "שגיאה פנימית בקביעת תור. נסה שוב." }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /tools/cancel-or-reschedule
// ─────────────────────────────────────────────────────────────────────────────

const cancelRescheduleSchema = z.object({
  phone:                z.string().min(5),
  action:               z.enum(["cancel", "reschedule"]),
  current_scheduled_at: z.string().regex(ISO_DATETIME_RE, "Expected ISO8601 datetime"),
  new_scheduled_at:     z.string().regex(ISO_DATETIME_RE, "Expected ISO8601 datetime").optional(),
  visit_type:           z.enum(VISIT_TYPE_VALUES).optional(),
});

toolsRoutes.post("/tools/cancel-or-reschedule", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = cancelRescheduleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ result: "פרמטרים חסרים: phone, action, current_scheduled_at (ISO8601)." }, 400);
  }

  const { phone, action, current_scheduled_at, new_scheduled_at, visit_type } = parsed.data;
  logger.info({ phone: maskPhone(phone), action }, "tool: cancel-or-reschedule");

  try {
    if (action === "cancel") {
      const result = await cancelAppointment(phone, current_scheduled_at);
      return c.json({ result });
    }

    if (!new_scheduled_at) {
      return c.json({ result: "לביצוע הזזה נדרש גם new_scheduled_at." }, 400);
    }

    const result = await rescheduleAppointment(phone, current_scheduled_at, new_scheduled_at, visit_type);
    return c.json({ result });
  } catch (err) {
    logger.error({ err, action }, "tool: cancel-or-reschedule — internal error");
    return c.json({ result: "שגיאה פנימית. נסה שוב." }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /tools/join-waitlist
// ─────────────────────────────────────────────────────────────────────────────

const waitlistSchema = z.object({
  phone:           z.string().min(5),
  customer_name:   z.string().min(1),
  pet_name:        z.string().min(1),
  pet_species:     z.string().min(1),
  pet_breed:       z.string().min(1).optional().nullable(),
  visit_type:      z.enum(VISIT_TYPE_VALUES),
  preferred_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  preferred_end:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:           z.string().optional(),
});

toolsRoutes.post("/tools/join-waitlist", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({
      result: "פרמטרים חסרים: phone, customer_name, pet_name, pet_species, visit_type.",
    }, 400);
  }

  try {
    logger.info({ phone: maskPhone(parsed.data.phone), visit_type: parsed.data.visit_type }, "tool: join-waitlist");
    const result = await joinWaitlist(parsed.data);
    return c.json({ result });
  } catch (err) {
    logger.error({ err }, "tool: join-waitlist — internal error");
    return c.json({ result: "שגיאה פנימית ברישום לרשימת ההמתנה. נסה שוב." }, 500);
  }
});
