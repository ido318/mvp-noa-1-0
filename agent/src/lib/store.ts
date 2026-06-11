import { getSupabase } from "./supabase.js";
import { getEnv } from "./env.js";
import {
  VisitType,
  getVisitConfig,
  effectiveDuration,
  getClinicHours,
  getDayNameHe,
  generateSlotsForVisitType,
  formatSlotLabel,
  formatDateHe,
  isWithin14Days,
  isTooLateToCancel,
  maxBookingDateIso,
  toIso,
  ISRAEL_TZ_OFFSET,
} from "./appointments.js";

export type Pet = { name: string; species: string };

export type Customer = {
  phone: string;
  full_name: string;
  pets: Pet[];
  // last_visit will be derived from the appointments table in a future phase
  notes: string | null;
};

export type EscalationEntry = {
  reason: string;
  urgency: number;
  conversation_id?: string | null;
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
    .select("phone, full_name, notes, pets(name, species)")
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
    pets: Array<{ name: string; species: string }> | null;
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
  });
  if (error) throw new Error(`supabase escalation insert failed: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

type CustomerRow = { id: string };
type AppointmentRow = { id: string; scheduled_at: string; appointment_type: string; duration_minutes: number };

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

  // 3. Calendar blocks — check if any block covers the requested date
  const dayStart = `${dateIso}T00:00:00${ISRAEL_TZ_OFFSET}`;
  const dayEnd   = `${dateIso}T23:59:59${ISRAEL_TZ_OFFSET}`;

  const { data: blocks, error: blockErr } = await getSupabase()
    .from("calendar_blocks")
    .select("start_at, end_at, reason")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .lt("start_at", dayEnd)
    .gt("end_at", dayStart)
    .limit(1);

  if (blockErr) throw new Error(`calendar_blocks query failed: ${blockErr.message}`);

  if (blocks && blocks.length > 0) {
    const block = blocks[0] as { start_at: string; end_at: string; reason: string | null };
    // Compute first available day after the block
    const blockEndDate = block.end_at.slice(0, 10);
    const reason = block.reason ? ` (${block.reason})` : "";
    return `נועה אינה זמינה בתאריך זה${reason}. ניתן לקבוע תור החל מ-${formatDateHe(blockEndDate)}.`;
  }

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

  // 5. Generate free slots for the requested visit type
  const freeSlots = generateSlotsForVisitType(dateIso, hours, visitType, bookedRanges);

  const config = getVisitConfig(visitType);
  const typeLabelHe = config.labelHe;

  if (freeSlots.length === 0) {
    return `אין חלונות פנויים ל${typeLabelHe} ב-${formatDateHe(dateIso)} (${getDayNameHe(dateIso)}). נסה תאריך אחר.`;
  }

  const labels = freeSlots.map(formatSlotLabel).join(", ");
  return `חלונות פנויים ל${typeLabelHe} ב-${formatDateHe(dateIso)} (יום ${getDayNameHe(dateIso)}): ${labels}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Book appointment
// ─────────────────────────────────────────────────────────────────────────────

export type BookAppointmentParams = {
  phone: string;
  customer_name: string;
  pet_name: string;
  pet_species: string;
  scheduled_at: string;
  visit_type: VisitType;
  reason?: string;
};

export async function bookAppointment(params: BookAppointmentParams): Promise<string> {
  const env = getEnv();
  const phone = normalisePhone(params.phone);
  const config = getVisitConfig(params.visit_type);
  const durMin = effectiveDuration(params.visit_type);
  const status = config.requiresApproval ? "pending_approval" : "scheduled";

  const { customerId } = await createOrFindCustomer(phone, params.customer_name);
  const { petId } = await createOrFindPet(customerId, params.pet_name, params.pet_species);

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
    })
    .select("id, scheduled_at")
    .single();

  if (error) {
    if (error.code === "23P01" || error.message.includes("appointments_no_active_overlap")) {
      return "השעה הזו כבר תפוסה. בחר/י שעה אחרת מהחלונות הפנויים.";
    }
    throw new Error(`bookAppointment failed: ${error.message}`);
  }

  const scheduledAt = typeof data.scheduled_at === "string" ? data.scheduled_at : params.scheduled_at;
  const slotLabel  = formatSlotLabel(scheduledAt);
  const dateLabel  = scheduledAt.slice(0, 10);

  if (config.requiresApproval) {
    return (
      `✅ בקשת תור ל${config.labelHe} נרשמה: ${formatDateHe(dateLabel)} בשעה ${slotLabel} ` +
      `עבור ${params.pet_name}. התור ממתין לאישור נועה — תקבל/י אישור SMS.`
    );
  }

  return (
    `✅ תור נקבע: ${formatDateHe(dateLabel)} בשעה ${slotLabel} ` +
    `עבור ${params.pet_name}. אשלח תזכורת SMS 24 שעות לפני.`
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
    })
    .eq("id", appt.id);

  if (cancelErr) throw new Error(`cancelAppointment update failed: ${cancelErr.message}`);

  const slotLabel = formatSlotLabel(appt.scheduled_at);

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

  const { error: rpcErr } = await getSupabase().rpc("reschedule_appointment", {
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

  const oldLabel = formatSlotLabel(oldAppt.scheduled_at);
  const newLabel = formatSlotLabel(newScheduledAt);
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
  visit_type: VisitType;
  preferred_start?: string; // YYYY-MM-DD
  preferred_end?: string;   // YYYY-MM-DD
  notes?: string;
};

export async function joinWaitlist(params: JoinWaitlistParams): Promise<string> {
  const env = getEnv();
  const phone = normalisePhone(params.phone);

  const { customerId } = await createOrFindCustomer(phone, params.customer_name);
  const { petId } = await createOrFindPet(customerId, params.pet_name, params.pet_species);

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
// Voice calls
// ─────────────────────────────────────────────────────────────────────────────

export async function saveVoiceCall(
  conversationId: string,
  durationSeconds: number | null,
  success: boolean | null,
  payload: Record<string, unknown>,
): Promise<void> {
  const env = getEnv();
  const callerNumber =
    typeof payload["caller_number"] === "string"
      ? payload["caller_number"]
      : "unknown";

  const status =
    success === true ? "completed" : success === false ? "failed" : "in_progress";

  const { error } = await getSupabase()
    .from("voice_calls")
    .upsert(
      {
        clinic_id:                    env.AGENT_CLINIC_ID,
        elevenlabs_conversation_id:   conversationId,
        direction:                    "inbound",
        status,
        duration_seconds:             durationSeconds,
        from_number:                  callerNumber,
        to_number:                    env.TWILIO_PHONE_NUMBER,
        agent_name:                   "tomer",
        metadata:                     payload,
      },
      { onConflict: "elevenlabs_conversation_id" },
    );
  if (error) throw new Error(`supabase voice_call upsert failed: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

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
    .select("id, scheduled_at, appointment_type, duration_minutes")
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
  const scheduled_at     = extractString(row, "scheduled_at");
  const appointment_type = extractString(row, "appointment_type") ?? "other";
  const duration_minutes = extractNumber(row, "duration_minutes") ?? 40;

  if (!id || !scheduled_at) return null;
  return { id, scheduled_at, appointment_type, duration_minutes };
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
    .insert({ clinic_id: env.AGENT_CLINIC_ID, customer_id: customerId, name: petName, species, status: "active" })
    .select("id")
    .single();

  if (insertErr) throw new Error(`createOrFindPet insert failed: ${insertErr.message}`);
  const id = extractId(inserted);
  if (!id) throw new Error("createOrFindPet: no id returned");
  return { petId: id };
}
