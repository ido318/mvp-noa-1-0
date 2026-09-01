import { getSupabase } from "./supabase.js";
import { getEnv } from "./env.js";
import { logger } from "./logger.js";
import {
  VisitType,
  getVisitConfig,
  effectiveDuration,
  getClinicHours,
  getDayNameHe,
  generateSlotsForVisitType,
  formatSlotSpokenHe,
  formatSlotOptionForTool,
  formatDateHe,
  isWithin14Days,
  isTooLateToCancel,
  maxBookingDateIso,
  toIso,
  toIsraelDateIso,
} from "./appointments.js";
import {
  scheduleBookingNotifications,
  cancelFutureNotifications,
  enqueueClientCancellationConfirmation,
} from "./notifications.js";
import { processNotifications } from "../services/notification.processor.js";
import { VALID_CALL_CATEGORIES } from "./callClassifier.js";

export type Pet = { name: string; species: string; breed: string | null };

export type Customer = {
  phone: string;
  full_name: string;
  pets: Pet[];
  // last_visit will be derived from the appointments table in a future phase
  notes: string | null;
};

// Pet summary including id — used by listCustomerPets, which (unlike
// findCustomerByPhone above) must let the calling LLM reference a specific
// pet by id in a later tool call (getPatientReminders, etc.).
export type PetSummary = { id: string; name: string; species: string };

export type ListCustomerPetsResult = {
  result: string;
  pets: PetSummary[];
};

export type EscalationEntry = {
  reason: string;
  urgency: number;
  conversation_id?: string | null;
  notes?: string | null;
};

/** Normalise Israeli phone to E.164. 054... → +97254... */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("972")) return `+${digits}`;
  if (digits.startsWith("0")) return `+972${digits.slice(1)}`;
  return `+${digits}`;
}

export async function findCustomerByPhone(
  phone: string,
): Promise<Customer | null> {
  const normalised = normalisePhone(phone);
  const env = getEnv();

  const { data, error } = await getSupabase()
    .from("customers")
    .select("phone, full_name, notes, pets(name, species, breed)")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .eq("phone", normalised)
    .is("deleted_at", null)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(`supabase lookup failed: ${error.message}`);
  if (!data) return null;

  const row = data as {
    phone: string;
    full_name: string;
    notes: string | null;
    pets: Array<{ name: string; species: string; breed: string | null }> | null;
  };

  return {
    phone: row.phone,
    full_name: row.full_name,
    notes: row.notes,
    pets: row.pets ?? [],
  };
}

export async function addEscalation(entry: EscalationEntry): Promise<void> {
  const env = getEnv();
  const { error } = await getSupabase().from("escalations").insert({
    clinic_id: env.AGENT_CLINIC_ID,
    reason: entry.reason,
    urgency: entry.urgency,
    elevenlabs_conversation_id: entry.conversation_id ?? null,
    notes: entry.notes ?? null,
  });
  if (error) throw new Error(`supabase escalation insert failed: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

type AppointmentRow = {
  id: string;
  scheduled_at: string;
  appointment_type: string;
  duration_minutes: number;
  customer_name: string;
  pet_name: string;
  customer_id: string;
};

function extractId(row: unknown): string | null {
  if (row !== null && typeof row === "object") {
    const val = (row as Record<string, unknown>)["id"];
    if (typeof val === "string") return val;
  }
  return null;
}

function extractString(row: unknown, key: string): string | null {
  if (row !== null && typeof row === "object") {
    const val = (row as Record<string, unknown>)[key];
    if (typeof val === "string") return val;
  }
  return null;
}

function extractNumber(row: unknown, key: string): number | null {
  if (row !== null && typeof row === "object") {
    const val = (row as Record<string, unknown>)[key];
    if (typeof val === "number") return val;
  }
  return null;
}

function isSameAppointmentSlot(a: string, b: string): boolean {
  const aMs = new Date(a).getTime();
  const bMs = new Date(b).getTime();
  return !Number.isNaN(aMs) && !Number.isNaN(bMs) && aMs === bMs;
}

function extractNestedString(row: unknown, parent: string, key: string): string | null {
  if (row !== null && typeof row === "object") {
    const nested = (row as Record<string, unknown>)[parent];
    if (nested !== null && typeof nested === "object") {
      const val = (nested as Record<string, unknown>)[key];
      if (typeof val === "string") return val;
    }
  }
  return null;
}

function extractTwilioCallSid(payload: Record<string, unknown>): string | null {
  const direct = payload["twilio_call_sid"];
  if (typeof direct === "string" && direct.trim()) return direct;

  const metadata = payload["metadata"];
  if (metadata !== null && typeof metadata === "object") {
    const value = (metadata as Record<string, unknown>)["twilio_call_sid"];
    if (typeof value === "string" && value.trim()) return value;
  }

  const initiation = payload["conversation_initiation_client_data"];
  if (initiation !== null && typeof initiation === "object") {
    const dynamicVariables = (initiation as Record<string, unknown>)["dynamic_variables"];
    if (dynamicVariables !== null && typeof dynamicVariables === "object") {
      const value = (dynamicVariables as Record<string, unknown>)["twilio_call_sid"];
      if (typeof value === "string" && value.trim()) return value;
    }
  }

  return null;
}

async function findCustomerIdByPhone(phone: string): Promise<string | null> {
  const env = getEnv();
  const { data, error } = await getSupabase()
    .from("customers")
    .select("id")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .eq("phone", phone)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`findCustomerIdByPhone failed: ${error.message}`);
  return extractId(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Availability
// ─────────────────────────────────────────────────────────────────────────────

export async function checkAvailability(
  dateIso: string,
  visitType: VisitType,
): Promise<string> {
  // 1. 14-day window
  if (!isWithin14Days(dateIso)) {
    const maxDate = maxBookingDateIso();
    return `ניתן לקבוע תורים עד ${formatDateHe(maxDate)} בלבד (14 יום קדימה).`;
  }

  // 2. Closed day (Saturday)
  const hours = getClinicHours(dateIso);
  if (!hours) {
    return "המרפאה סגורה בשבת. אפשר לקבוע תור ביום ראשון עד חמישי 08:00-20:00 או ביום שישי 08:30-13:00.";
  }

  const env = getEnv();

  // 3. Calendar blocks — unavailable ranges for the requested date
  const dayStart = toIso(dateIso, 0, 0);
  const dayEnd   = toIso(dateIso, 23, 59);

  const { data: blocks, error: blockErr } = await getSupabase()
    .from("calendar_blocks")
    .select("start_at, end_at, reason")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .lt("start_at", dayEnd)
    .gt("end_at", dayStart);

  if (blockErr) throw new Error(`calendar_blocks query failed: ${blockErr.message}`);

  // 4. Fetch existing appointments for the day (scheduled_at + end_at)
  const { data: appts, error: apptErr } = await getSupabase()
    .from("appointments")
    .select("scheduled_at, end_at")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .in("status", ["scheduled", "confirmed", "pending_approval"])
    .is("deleted_at", null)
    .gte("scheduled_at", dayStart)
    .lte("scheduled_at", dayEnd);

  if (apptErr) throw new Error(`checkAvailability query failed: ${apptErr.message}`);

  const bookedRanges = (appts ?? []).flatMap((r) => {
    const start = extractString(r, "scheduled_at");
    const end   = extractString(r, "end_at");
    return start && end ? [{ start, end }] : [];
  });

  const blockedRanges = (blocks ?? []).flatMap((r) => {
    const start = extractString(r, "start_at");
    const end = extractString(r, "end_at");
    return start && end ? [{ start, end }] : [];
  });

  // 5. Generate free slots for the requested visit type
  const freeSlots = generateSlotsForVisitType(dateIso, hours, visitType, [
    ...bookedRanges,
    ...blockedRanges,
  ]);

  const config = getVisitConfig(visitType);
  const typeLabelHe = config.labelHe;

  if (freeSlots.length === 0) {
    return `אין חלונות פנויים ל${typeLabelHe} ב-${formatDateHe(dateIso)} (${getDayNameHe(dateIso)}). נסה תאריך אחר.`;
  }

  const labels = freeSlots.map(formatSlotOptionForTool).join(", ");
  return (
    `חלונות פנויים ל${typeLabelHe} ב-${formatDateHe(dateIso)} (יום ${getDayNameHe(dateIso)}): ${labels}. ` +
    "לקביעת תור חובה להשתמש בערך scheduled_at המדויק מאחת האופציות, כולל אזור הזמן. " +
    "זו רשימה מלאה למטרות התאמה בלבד — אסור להקריא אותה ללקוח כמות שהיא. " +
    "הצע בקול רק את 2-3 השעות המוקדמות ביותר, אלא אם הלקוח ציין העדפת זמן אחרת (בוקר/צהריים/אחה\"צ) — " +
    "ואז הצע 2-3 שעות מהטווח הזה בלבד."
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Book appointment
// ─────────────────────────────────────────────────────────────────────────────

export type BookAppointmentParams = {
  phone: string;
  customer_name: string;
  pet_name: string;
  pet_species: string;
  pet_breed?: string | null;
  scheduled_at: string;
  visit_type: VisitType;
  reason?: string;
  twilio_call_sid?: string;
  elevenlabs_conversation_id?: string;
};

export async function bookAppointment(params: BookAppointmentParams): Promise<string> {
  const env = getEnv();
  const phone = normalisePhone(params.phone);
  const config = getVisitConfig(params.visit_type);
  const durMin = effectiveDuration(params.visit_type);
  const status = config.requiresApproval ? "pending_approval" : "scheduled";

  const { customerId } = await createOrFindCustomer(phone, params.customer_name);
  const { petId } = await createOrFindPet(customerId, params.pet_name, params.pet_species, params.pet_breed);

  const { data, error } = await getSupabase()
    .from("appointments")
    .insert({
      clinic_id:        env.AGENT_CLINIC_ID,
      customer_id:      customerId,
      pet_id:           petId,
      appointment_type: params.visit_type,
      status,
      source:           "phone",
      scheduled_at:     params.scheduled_at,
      duration_minutes: durMin,
      reason:           params.reason ?? null,
      changed_via:      "agent",
    })
    .select("id, scheduled_at")
    .single();

  if (error) {
    if (error.code === "23P01" || error.message.includes("appointments_no_active_overlap")) {
      logger.warn(
        {
          phone: params.phone,
          visitType: params.visit_type,
          scheduledAt: params.scheduled_at,
          error,
        },
        "bookAppointment: slot overlap, booking was not created",
      );

      try {
        const dateIso = params.scheduled_at.slice(0, 10);
        const availability = await checkAvailability(dateIso, params.visit_type);
        return `השעה הזו כבר תפוסה. ${availability}`;
      } catch (availabilityErr) {
        logger.error(
          { err: availabilityErr, scheduledAt: params.scheduled_at, visitType: params.visit_type },
          "bookAppointment: failed to refresh availability after overlap",
        );
        return "השעה הזו כבר תפוסה. בחר/י שעה אחרת מהחלונות הפנויים.";
      }
    }
    logger.error(
      { err: error, scheduledAt: params.scheduled_at, visitType: params.visit_type },
      "bookAppointment: appointment insert failed",
    );
    throw new Error(`bookAppointment failed: ${error.message}`);
  }

  const appointmentId = extractId(data);
  const scheduledAt   = typeof data.scheduled_at === "string" ? data.scheduled_at : params.scheduled_at;
  const slotLabel     = formatSlotSpokenHe(scheduledAt);
  const dateLabel     = toIsraelDateIso(new Date(scheduledAt));

  if (appointmentId) {
    await linkVoiceCall({
      twilioCallSid: params.twilio_call_sid,
      conversationId: params.elevenlabs_conversation_id,
      customerId,
      petId,
      appointmentId,
    });
  }

  // Fire-and-forget SMS notifications — only for confirmed bookings.
  // pending_approval (neutering) must NOT create notifications here;
  // they are created by the dashboard approve flow instead.
  if (appointmentId && !config.requiresApproval) {
    void scheduleBookingNotifications({
      appointmentId,
      scheduledAt,
      durationMinutes: durMin,
      visitType:       params.visit_type,
      clinicId:        env.AGENT_CLINIC_ID,
      customerId,
      phone,
      customerName:    params.customer_name,
      petName:         params.pet_name,
    })
      .then(() => processNotifications({ appointmentId }))
      .catch((err: unknown) => logger.error({ err, appointmentId }, "SMS book fire-and-forget failed"));
  }

  if (config.requiresApproval) {
    return (
      `בקשת התור ל${config.labelHe} נרשמה ל-${formatDateHe(dateLabel)} בשעה ${slotLabel} ` +
      `עבור ${params.pet_name}. התור ממתין לאישור נועה.`
    );
  }

  return (
    `תור נקבע ל-${formatDateHe(dateLabel)} בשעה ${slotLabel} עבור ${params.pet_name}.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancel / reschedule
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelAppointment(phone: string, scheduledAt: string): Promise<string> {
  const env = getEnv();
  const normalised = normalisePhone(phone);

  const customerId = await findCustomerIdByPhone(normalised);
  if (!customerId) return "לא מצאנו לקוח עם מספר הטלפון הזה.";

  const appt = await findActiveAppointmentNear(env.AGENT_CLINIC_ID, customerId, scheduledAt);
  if (!appt) return "לא מצאנו תור פעיל בשעה הזו. ייתכן שכבר בוטל.";

  const lateCancellation = isTooLateToCancel(appt.scheduled_at);
  const newStatus = lateCancellation ? "late_cancellation" : "cancelled";

  const { error: cancelErr } = await getSupabase()
    .from("appointments")
    .update({
      status:       newStatus,
      cancelled_at: new Date().toISOString(),
      changed_via:  "agent",
    })
    .eq("id", appt.id);

  if (cancelErr) throw new Error(`cancelAppointment update failed: ${cancelErr.message}`);

  // Fire-and-forget: cancel future notifications + send client confirmation SMS
  void enqueueClientCancellationConfirmation({
    appointmentId: appt.id,
    scheduledAt:   appt.scheduled_at,
    clinicId:      env.AGENT_CLINIC_ID,
    customerId:    appt.customer_id,
    phone:         normalised,
    customerName:  appt.customer_name,
    petName:       appt.pet_name,
  })
    .then(() => processNotifications({ appointmentId: appt.id }))
    .catch((err: unknown) => logger.error({ err, appointmentId: appt.id }, "SMS cancel fire-and-forget failed"));

  const slotLabel = formatSlotSpokenHe(appt.scheduled_at);

  if (lateCancellation) {
    return (
      `התור בשעה ${slotLabel} סומן כביטול מאוחר (פחות מ-4 שעות לפני). ` +
      `לפי המדיניות יחויב במלואו.`
    );
  }

  return `✅ התור בשעה ${slotLabel} בוטל בהצלחה.`;
}

export async function rescheduleAppointment(
  phone: string,
  currentScheduledAt: string,
  newScheduledAt: string,
  visitType?: VisitType,
): Promise<string> {
  const env = getEnv();
  const normalised = normalisePhone(phone);

  const customerId = await findCustomerIdByPhone(normalised);
  if (!customerId) return "לא מצאנו לקוח עם מספר הטלפון הזה.";

  const oldAppt = await findActiveAppointmentNear(env.AGENT_CLINIC_ID, customerId, currentScheduledAt);
  if (!oldAppt) return "לא מצאנו תור פעיל בשעה הזו. ייתכן שכבר בוטל.";

  if (isTooLateToCancel(oldAppt.scheduled_at)) {
    return "לא ניתן להזיז תור פחות מ-4 שעות לפני מועדו. לסיוע נוסף — פנה ישירות לנועה.";
  }

  // Resolve effective duration: prefer explicit visitType, fallback to stored type
  const resolvedType = (visitType ?? oldAppt.appointment_type) as VisitType;
  const durMin = effectiveDuration(resolvedType);

  if (isSameAppointmentSlot(oldAppt.scheduled_at, newScheduledAt)) {
    const nextStatus = getVisitConfig(resolvedType).requiresApproval ? "pending_approval" : "scheduled";
    const { error: updateErr } = await getSupabase()
      .from("appointments")
      .update({
        appointment_type: resolvedType,
        duration_minutes: durMin,
        status:           nextStatus,
        changed_via:      "agent",
      })
      .eq("id", oldAppt.id);

    if (updateErr) {
      if (updateErr.code === "23P01" || updateErr.message.includes("appointments_no_active_overlap")) {
        return "אי אפשר לשנות לסוג הביקור הזה באותה שעה כי משך התור החדש מתנגש עם תור אחר.";
      }
      throw new Error(`rescheduleAppointment type update failed: ${updateErr.message}`);
    }

    return `✅ סוג התור עודכן ל${getVisitConfig(resolvedType).labelHe} בשעה ${formatSlotSpokenHe(oldAppt.scheduled_at)}.`;
  }

  const { data: rpcData, error: rpcErr } = await getSupabase().rpc("reschedule_appointment", {
    p_clinic_id:          env.AGENT_CLINIC_ID,
    p_old_appointment_id: oldAppt.id,
    p_new_scheduled_at:   newScheduledAt,
    p_duration_minutes:   durMin,
  });

  if (rpcErr) {
    if (rpcErr.message.includes("appointments_no_active_overlap") || rpcErr.code === "23P01") {
      return "השעה החדשה כבר תפוסה. בחר/י שעה אחרת.";
    }
    throw new Error(`rescheduleAppointment rpc failed: ${rpcErr.message}`);
  }

  const newAppointmentId = typeof rpcData === "string" ? rpcData : null;

  // Set changed_via on the new appointment and fire SMS notifications
  if (newAppointmentId) {
    void (async () => {
      try {
        await getSupabase()
          .from("appointments")
          .update({ changed_via: "agent" })
          .eq("id", newAppointmentId);

        await cancelFutureNotifications(oldAppt.id, env.AGENT_CLINIC_ID);
        await scheduleBookingNotifications({
          appointmentId:   newAppointmentId,
          scheduledAt:     newScheduledAt,
          durationMinutes: durMin,
          visitType:       resolvedType,
          clinicId:        env.AGENT_CLINIC_ID,
          customerId:      oldAppt.customer_id,
          phone:           normalised,
          customerName:    oldAppt.customer_name,
          petName:         oldAppt.pet_name,
        });
        await processNotifications({ appointmentId: newAppointmentId });
      } catch (err) {
        logger.error({ err, newAppointmentId }, "SMS reschedule fire-and-forget failed");
      }
    })();
  }

  const oldLabel = formatSlotSpokenHe(oldAppt.scheduled_at);
  const newLabel = formatSlotSpokenHe(newScheduledAt);
  const newDate  = newScheduledAt.slice(0, 10);
  return `✅ התור הוזז בהצלחה מ-${oldLabel} ל-${formatDateHe(newDate)} בשעה ${newLabel}.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Waitlist
// ─────────────────────────────────────────────────────────────────────────────

export type JoinWaitlistParams = {
  phone: string;
  customer_name: string;
  pet_name: string;
  pet_species: string;
  pet_breed?: string | null;
  visit_type: VisitType;
  preferred_start?: string; // YYYY-MM-DD
  preferred_end?: string;   // YYYY-MM-DD
  notes?: string;
};

export async function joinWaitlist(params: JoinWaitlistParams): Promise<string> {
  const env = getEnv();
  const phone = normalisePhone(params.phone);

  const { customerId } = await createOrFindCustomer(phone, params.customer_name);
  const { petId } = await createOrFindPet(customerId, params.pet_name, params.pet_species, params.pet_breed);

  const { error } = await getSupabase().from("waitlist").insert({
    clinic_id:       env.AGENT_CLINIC_ID,
    customer_id:     customerId,
    pet_id:          petId,
    visit_type:      params.visit_type,
    preferred_start: params.preferred_start ?? null,
    preferred_end:   params.preferred_end   ?? null,
    status:          "waiting",
    notes:           params.notes ?? null,
  });

  if (error) throw new Error(`joinWaitlist insert failed: ${error.message}`);

  const config = getVisitConfig(params.visit_type);
  return (
    `✅ ${params.pet_name} נרשמ/ה לרשימת ההמתנה ל${config.labelHe}. ` +
    `נועה תצור קשר כשיפתח מקום. ` +
    `אם מצב בעל החיים מחמיר — פנה/י לבית חולים וטרינרי.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Patient lookup (Voice SOAP Generator support)
//
// These four tools let Tomer answer follow-up questions about a specific
// pet during a call (vaccination reminders, chronic conditions, last visit's
// plan). Every one of the three pet-scoped lookups below (all but
// listCustomerPets) MUST go through verifyPetOwnership first — see the
// "Private helpers" section — so a confused/hallucinating LLM can never use
// a stale or wrong pet_id from an earlier turn or a different call to read
// another customer's pet data.
// ─────────────────────────────────────────────────────────────────────────────

const REMINDER_WINDOW_DAYS = 60;

export async function listCustomerPets(phone: string): Promise<ListCustomerPetsResult> {
  const normalised = normalisePhone(phone);
  const env = getEnv();

  const { data, error } = await getSupabase()
    .from("customers")
    .select("full_name, pets(id, name, species)")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .eq("phone", normalised)
    .is("deleted_at", null)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(`listCustomerPets failed: ${error.message}`);

  if (!data) {
    return {
      result: "לקוח לא מוכר במערכת. לא נמצאו חיות רשומות למספר הטלפון הזה.",
      pets: [],
    };
  }

  const row = data as { full_name: string; pets: PetSummary[] | null };
  const pets = row.pets ?? [];

  if (pets.length === 0) {
    return { result: `לא נמצאו חיות רשומות עבור ${row.full_name}.`, pets: [] };
  }

  if (pets.length === 1) {
    const p = pets[0]!;
    return {
      result: `החיה הרשומה עבור ${row.full_name} היא ${p.name} (${p.species}), מזהה pet_id: ${p.id}.`,
      pets,
    };
  }

  const listHe = pets.map((p) => `${p.name} (${p.species}, pet_id: ${p.id})`).join(", ");
  return {
    result:
      `ל${row.full_name} יש כמה חיות רשומות: ${listHe}. ` +
      "יש לשאול לאיזו חיה מתייחסת הפנייה, ולהשתמש ב-pet_id המתאים בקריאות הבאות.",
    pets,
  };
}

export async function getPatientReminders(phone: string, petId: string): Promise<string> {
  const pet = await verifyPetOwnership(phone, petId);
  if (!pet) return PET_NOT_FOUND_HE;

  const env = getEnv();
  const { data, error } = await getSupabase()
    .from("vaccinations")
    .select("vaccine_name, next_due_at")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .eq("pet_id", pet.id)
    .is("deleted_at", null)
    .not("next_due_at", "is", null)
    .order("next_due_at", { ascending: true });

  if (error) throw new Error(`getPatientReminders failed: ${error.message}`);

  const rows = (data ?? []) as Array<{ vaccine_name: string; next_due_at: string }>;
  if (rows.length === 0) {
    return `אין תזכורות חיסון ממתינות עבור ${pet.name}.`;
  }

  // next_due_at is a plain `date` column (no time/timezone component), so
  // "YYYY-MM-DD" string comparison against today's Israel-local date is both
  // correct and simpler than round-tripping through Date/ms.
  const todayIso = toIsraelDateIso(new Date());
  const windowEndMs =
    new Date(toIso(todayIso, 0, 0)).getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const overdue: string[] = [];
  const upcoming: string[] = [];

  for (const row of rows) {
    if (!row.next_due_at) continue;
    const dueDateIso = row.next_due_at.slice(0, 10);
    const dateLabel = formatDateHe(dueDateIso);

    if (dueDateIso < todayIso) {
      overdue.push(`${row.vaccine_name} (${dateLabel})`);
    } else if (new Date(toIso(dueDateIso, 0, 0)).getTime() <= windowEndMs) {
      upcoming.push(`${row.vaccine_name} (${dateLabel})`);
    }
  }

  if (overdue.length === 0 && upcoming.length === 0) {
    return `אין תזכורות חיסון קרובות עבור ${pet.name} בטווח הקרוב.`;
  }

  const parts: string[] = [];
  if (overdue.length > 0) {
    parts.push(`חיסונים באיחור עבור ${pet.name}: ${overdue.join(", ")}.`);
  }
  if (upcoming.length > 0) {
    parts.push(`חיסונים קרובים עבור ${pet.name}: ${upcoming.join(", ")}.`);
  }

  return parts.join(" ");
}

export async function getPatientChronicConditions(phone: string, petId: string): Promise<string> {
  const pet = await verifyPetOwnership(phone, petId);
  if (!pet) return PET_NOT_FOUND_HE;

  const env = getEnv();

  const { data: petRow, error: petErr } = await getSupabase()
    .from("pets")
    .select("chronic_conditions")
    .eq("id", pet.id)
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .maybeSingle();
  if (petErr) throw new Error(`getPatientChronicConditions pet query failed: ${petErr.message}`);

  const chronicText = extractString(petRow, "chronic_conditions");

  const { data: recordRow, error: recordErr } = await getSupabase()
    .from("medical_records")
    .select("active_problem_list")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .eq("pet_id", pet.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (recordErr) {
    throw new Error(`getPatientChronicConditions medical_records query failed: ${recordErr.message}`);
  }

  const conditionNames = extractProblemList(recordRow)
    .map((entry) => entry.condition)
    .filter((c): c is string => typeof c === "string" && c.trim().length > 0);

  const hasChronicText = !!chronicText?.trim();
  const hasProblems = conditionNames.length > 0;

  if (!hasChronicText && !hasProblems) {
    return `אין רשומות של מצבים כרוניים עבור ${pet.name}.`;
  }

  const parts: string[] = [];
  if (hasChronicText) {
    parts.push(`מצבים כרוניים ידועים עבור ${pet.name}: ${chronicText!.trim()}.`);
  }
  if (hasProblems) {
    parts.push(`רשימת בעיות פעילה: ${conditionNames.join(", ")}.`);
  }
  parts.push(
    'אם בעל החיה מדווח כרגע על החמרה במצב — יש להציע את התור המוקדם ביותר האפשרי ולשקול הפניה לד"ר נועה.',
  );

  return parts.join(" ");
}

export async function getLastVisitPlan(phone: string, petId: string): Promise<string> {
  const pet = await verifyPetOwnership(phone, petId);
  if (!pet) return PET_NOT_FOUND_HE;

  const env = getEnv();
  const visitIds = await findPetVisitIds(env.AGENT_CLINIC_ID, pet.id);

  if (visitIds.length > 0) {
    const { data, error } = await getSupabase()
      .from("medical_notes")
      .select("plan, created_at")
      .eq("clinic_id", env.AGENT_CLINIC_ID)
      .in("visit_id", visitIds)
      .eq("note_type", "soap_full")
      .eq("status", "approved")
      .is("deleted_at", null)
      .not("plan", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`getLastVisitPlan notes query failed: ${error.message}`);

    const plan = extractString(data, "plan");
    if (plan && plan.trim()) {
      const createdAt = extractString(data, "created_at");
      const dateLabel = createdAt ? formatDateHe(toIsraelDateIso(new Date(createdAt))) : null;
      return dateLabel
        ? `בביקור האחרון, בתאריך ${dateLabel}, ד"ר נועה קבעה את התוכנית הבאה עבור ${pet.name}: ${plan.trim()}`
        : `בביקור האחרון ד"ר נועה קבעה את התוכנית הבאה עבור ${pet.name}: ${plan.trim()}`;
    }
  }

  // Fallback: no approved soap_full plan on record — try the most recent
  // visit's manual/AI summary instead. Never fall back to a draft note's
  // plan — an unapproved plan may still change before Noa signs off on it.
  const { data: visitRow, error: visitErr } = await getSupabase()
    .from("visits")
    .select("manual_visit_summary, ai_visit_summary")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .eq("pet_id", pet.id)
    .is("deleted_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (visitErr) throw new Error(`getLastVisitPlan visit fallback query failed: ${visitErr.message}`);

  const summary =
    extractString(visitRow, "manual_visit_summary") ?? extractString(visitRow, "ai_visit_summary");

  if (summary && summary.trim()) {
    return `לא נמצאה תוכנית טיפול מאושרת מהביקור האחרון עבור ${pet.name}. תקציר הביקור האחרון: ${summary.trim()}`;
  }

  return `לא נמצאה תוכנית המשך רשומה עבור ${pet.name}.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Voice calls
// ─────────────────────────────────────────────────────────────────────────────

export type SaveVoiceCallEnrichment = {
  transcript?: unknown[] | null;
  aiSummary?: string | null;
  callCategory?: "operation" | "information" | null;
  recordingStoragePath?: string | null;
};

export type SaveIncomingVoiceCallParams = {
  twilioCallSid: string;
  fromNumber: string;
  toNumber: string;
  status: "in_progress";
  metadata: Record<string, unknown>;
};

export async function saveIncomingVoiceCall(
  params: SaveIncomingVoiceCallParams,
): Promise<void> {
  const env = getEnv();
  const { error } = await getSupabase()
    .from("voice_calls")
    .upsert(
      {
        clinic_id:        env.AGENT_CLINIC_ID,
        direction:        "inbound",
        status:           params.status,
        from_number:      params.fromNumber,
        to_number:        params.toNumber,
        twilio_call_sid:  params.twilioCallSid,
        agent_name:       "tomer",
        metadata:         params.metadata,
      },
      { onConflict: "twilio_call_sid" },
    );
  if (error) throw new Error(`supabase incoming voice_call upsert failed: ${error.message}`);
}

export async function saveVoiceCall(
  conversationId: string,
  durationSeconds: number | null,
  success: boolean | null,
  payload: Record<string, unknown>,
  enrichment: SaveVoiceCallEnrichment = {},
): Promise<void> {
  const env = getEnv();
  const callerNumber =
    typeof payload["caller_number"] === "string"
      ? payload["caller_number"]
      : "unknown";
  const customerId = callerNumber !== "unknown"
    ? await safeFindCustomerIdByPhone(normalisePhone(callerNumber))
    : null;

  const payloadStatus =
    typeof payload["status"] === "string" ? payload["status"].toLowerCase() : null;
  const status =
    success === true ||
    payloadStatus === "done" ||
    payloadStatus === "completed" ||
    payloadStatus === "success"
      ? "completed"
      : success === false ||
          payloadStatus === "failed" ||
          payloadStatus === "error"
        ? "failed"
        : "in_progress";

  const row: Record<string, unknown> = {
    clinic_id:                    env.AGENT_CLINIC_ID,
    elevenlabs_conversation_id:   conversationId,
    direction:                    "inbound",
    status,
    duration_seconds:             durationSeconds,
    from_number:                  callerNumber,
    to_number:                    env.TWILIO_PHONE_NUMBER,
    agent_name:                   "tomer",
    metadata:                     payload,
  };

  if (customerId) row["customer_id"] = customerId;
  if (status === "completed" || status === "failed") row["ended_at"] = new Date().toISOString();
  if (enrichment.transcript !== undefined)            row["transcript"]              = enrichment.transcript;
  if (enrichment.aiSummary !== undefined)             row["ai_summary"]              = enrichment.aiSummary;
  if (enrichment.callCategory !== undefined) {
    const cat = enrichment.callCategory;
    row["call_category"] = cat !== null && VALID_CALL_CATEGORIES.has(cat) ? cat : null;
  }
  if (enrichment.recordingStoragePath !== undefined)  row["recording_storage_path"]  = enrichment.recordingStoragePath;

  const twilioCallSid = extractTwilioCallSid(payload);
  if (twilioCallSid) {
    const { data, error } = await getSupabase()
      .from("voice_calls")
      .update(row)
      .eq("twilio_call_sid", twilioCallSid)
      .select("id");
    if (error) throw new Error(`supabase voice_call update failed: ${error.message}`);
    if (data && data.length > 0) return;
    logger.warn(
      { twilioCallSid, conversationId },
      "voice_call: no row matched twilio_call_sid, falling back to upsert by conversation id",
    );
  }

  const { error } = await getSupabase()
    .from("voice_calls")
    .upsert(row, { onConflict: "elevenlabs_conversation_id" });
  if (error) throw new Error(`supabase voice_call upsert failed: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Generic, non-leaking message for every failure mode of verifyPetOwnership:
// unknown phone, malformed pet_id, non-existent pet, or a pet that exists
// but belongs to a different customer/clinic. Never hint at which case it was.
const PET_NOT_FOUND_HE = "לא מצאתי חיה כזו ברשומות שלך.";

type ProblemListEntry = {
  condition: string;
  onsetDate?: string | null;
  severity?: string | null;
  notes?: string | null;
};

function extractProblemList(row: unknown): ProblemListEntry[] {
  if (row === null || typeof row !== "object") return [];
  const val = (row as Record<string, unknown>)["active_problem_list"];
  if (!Array.isArray(val)) return [];
  return val.filter(
    (item): item is ProblemListEntry =>
      item !== null &&
      typeof item === "object" &&
      typeof (item as Record<string, unknown>)["condition"] === "string",
  );
}

/**
 * Mandatory cross-check reused by every pet-scoped lookup (getPatientReminders,
 * getPatientChronicConditions, getLastVisitPlan): confirms petId is a
 * syntactically valid UUID AND actually belongs to a pet owned by the
 * customer identified by phone, within AGENT_CLINIC_ID. Returns null for
 * every failure mode (malformed UUID, unknown phone, non-existent pet, or a
 * pet belonging to a different customer/clinic) — callers must map a null
 * result to the single generic PET_NOT_FOUND_HE message and must never leak
 * which failure mode occurred (e.g. never reveal that the pet_id belongs to
 * someone else). This defends against a confused/hallucinating LLM reusing a
 * stale or wrong pet_id from an earlier turn or a different call.
 */
async function verifyPetOwnership(phone: string, petId: string): Promise<PetSummary | null> {
  if (!UUID_RE.test(petId)) return null;

  const normalised = normalisePhone(phone);
  const customerId = await findCustomerIdByPhone(normalised);
  if (!customerId) return null;

  const env = getEnv();
  const { data, error } = await getSupabase()
    .from("pets")
    .select("id, name, species")
    .eq("id", petId)
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`verifyPetOwnership failed: ${error.message}`);
  if (!data) return null;

  const id = extractId(data);
  const name = extractString(data, "name");
  const species = extractString(data, "species");
  if (!id || !name || !species) return null;

  return { id, name, species };
}

async function findPetVisitIds(clinicId: string, petId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("visits")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("pet_id", petId)
    .is("deleted_at", null);

  if (error) throw new Error(`findPetVisitIds failed: ${error.message}`);

  return (data ?? []).flatMap((row) => {
    const id = extractId(row);
    return id ? [id] : [];
  });
}

async function findActiveAppointmentNear(
  clinicId: string,
  customerId: string,
  scheduledAt: string,
): Promise<AppointmentRow | null> {
  const target = new Date(scheduledAt);
  if (isNaN(target.getTime())) return null;

  const rangeStart = new Date(target.getTime() - 2 * 60 * 1000).toISOString();
  const rangeEnd   = new Date(target.getTime() + 2 * 60 * 1000).toISOString();

  const { data, error } = await getSupabase()
    .from("appointments")
    .select("id, customer_id, scheduled_at, appointment_type, duration_minutes, customers(full_name), pets(name)")
    .eq("clinic_id", clinicId)
    .eq("customer_id", customerId)
    .in("status", ["scheduled", "confirmed", "pending_approval"])
    .is("deleted_at", null)
    .gte("scheduled_at", rangeStart)
    .lte("scheduled_at", rangeEnd)
    .limit(1);

  if (error) throw new Error(`findActiveAppointmentNear failed: ${error.message}`);
  if (!data || data.length === 0) return null;

  const row = data[0];
  const id               = extractId(row);
  const customer_id      = extractString(row, "customer_id") ?? customerId;
  const scheduled_at     = extractString(row, "scheduled_at");
  const appointment_type = extractString(row, "appointment_type") ?? "other";
  const duration_minutes = extractNumber(row, "duration_minutes") ?? 40;
  const customer_name    = extractNestedString(row, "customers", "full_name") ?? "";
  const pet_name         = extractNestedString(row, "pets", "name") ?? "";

  if (!id || !scheduled_at) return null;
  return { id, customer_id, scheduled_at, appointment_type, duration_minutes, customer_name, pet_name };
}

async function safeFindCustomerIdByPhone(phone: string): Promise<string | null> {
  try {
    return await findCustomerIdByPhone(phone);
  } catch (err) {
    logger.warn({ err }, "voice_call: customer lookup failed");
    return null;
  }
}

async function linkVoiceCall(params: {
  twilioCallSid?: string;
  conversationId?: string;
  customerId: string;
  petId?: string | null;
  appointmentId?: string | null;
  visitId?: string | null;
}): Promise<void> {
  if (!params.twilioCallSid && !params.conversationId) return;

  const patch = {
    customer_id: params.customerId,
    pet_id: params.petId ?? null,
    appointment_id: params.appointmentId ?? null,
    visit_id: params.visitId ?? null,
  };

  if (params.twilioCallSid) {
    const { data, error } = await getSupabase()
      .from("voice_calls")
      .update(patch)
      .eq("twilio_call_sid", params.twilioCallSid)
      .select("id");
    if (error) throw new Error(`linkVoiceCall by twilio sid failed: ${error.message}`);
    if (data && data.length > 0) return;
  }

  if (params.conversationId) {
    const { error } = await getSupabase()
      .from("voice_calls")
      .update(patch)
      .eq("elevenlabs_conversation_id", params.conversationId);
    if (error) throw new Error(`linkVoiceCall by conversation id failed: ${error.message}`);
  }
}

async function createOrFindCustomer(
  phone: string,
  name: string,
): Promise<{ customerId: string }> {
  const existingId = await findCustomerIdByPhone(phone);
  if (existingId) return { customerId: existingId };

  const env = getEnv();
  const { data: inserted, error } = await getSupabase()
    .from("customers")
    .insert({ clinic_id: env.AGENT_CLINIC_ID, full_name: name, phone, status: "active" })
    .select("id")
    .single();

  if (error) throw new Error(`createOrFindCustomer failed: ${error.message}`);
  const id = extractId(inserted);
  if (!id) throw new Error("createOrFindCustomer: no id returned");
  return { customerId: id };
}

async function createOrFindPet(
  customerId: string,
  petName: string,
  species: string,
  breed?: string | null,
): Promise<{ petId: string }> {
  const env = getEnv();

  const { data: existing, error: findErr } = await getSupabase()
    .from("pets")
    .select("id")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .eq("customer_id", customerId)
    .ilike("name", petName)
    .is("deleted_at", null)
    .maybeSingle();

  if (findErr) throw new Error(`createOrFindPet lookup failed: ${findErr.message}`);

  const existingId = extractId(existing);
  if (existingId) return { petId: existingId };

  const { data: inserted, error: insertErr } = await getSupabase()
    .from("pets")
    .insert({
      clinic_id:   env.AGENT_CLINIC_ID,
      customer_id: customerId,
      name:        petName,
      species,
      breed:       breed?.trim() ? breed.trim() : null,
      status:      "active",
    })
    .select("id")
    .single();

  if (insertErr) throw new Error(`createOrFindPet insert failed: ${insertErr.message}`);
  const id = extractId(inserted);
  if (!id) throw new Error("createOrFindPet: no id returned");
  return { petId: id };
}
