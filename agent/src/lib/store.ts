import { getSupabase } from "./supabase.js";
import { getEnv } from "./env.js";
import {
  getClinicHours,
  getDayNameHe,
  generateAllSlots,
  filterFreeSlots,
  formatSlotLabel,
  formatDateHe,
  toIso,
} from "./appointments.js";

export type Pet = { name: string; species: string };

export type Customer = {
  phone: string;
  full_name: string;
  pets: Pet[];
  // TODO: last_visit will be derived from the appointments table in a future phase
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
// Appointments
// ─────────────────────────────────────────────────────────────────────────────

export type AppointmentSlot = string; // ISO8601 with +03:00

type CustomerRow = { id: string };
type AppointmentRow = { id: string; scheduled_at: string };

function extractId(row: unknown): string | null {
  if (row !== null && typeof row === "object" && "id" in row && typeof (row as Record<string, unknown>).id === "string") {
    return (row as CustomerRow).id;
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

export async function checkAvailability(dateIso: string): Promise<string> {
  const hours = getClinicHours(dateIso);
  if (!hours) {
    return "המרפאה סגורה בשבת. אפשר לקבוע תור ביום ראשון עד חמישי 08:00-20:00 או ביום שישי 08:30-13:00.";
  }

  const env = getEnv();
  const dayStart = toIso(dateIso, 0, 0);
  const dayEnd = toIso(dateIso, 23, 59);

  const { data, error } = await getSupabase()
    .from("appointments")
    .select("scheduled_at")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .in("status", ["scheduled", "confirmed"])
    .is("deleted_at", null)
    .gte("scheduled_at", dayStart)
    .lte("scheduled_at", dayEnd);

  if (error) throw new Error(`checkAvailability query failed: ${error.message}`);

  const takenIsos = (data ?? []).map((r) => r.scheduled_at as string);
  const allSlots = generateAllSlots(dateIso, hours);
  const freeSlots = filterFreeSlots(allSlots, takenIsos);

  if (freeSlots.length === 0) {
    return `אין חלונות פנויים ב-${formatDateHe(dateIso)} (${getDayNameHe(dateIso)}). נסה תאריך אחר.`;
  }

  const labels = freeSlots.map(formatSlotLabel).join(", ");
  return `חלונות פנויים ב-${formatDateHe(dateIso)} (יום ${getDayNameHe(dateIso)}): ${labels}`;
}

export type BookAppointmentParams = {
  phone: string;
  customer_name: string;
  pet_name: string;
  pet_species: string;
  scheduled_at: string;
  visit_type: "checkup" | "vaccination" | "consultation" | "urgent" | "follow_up" | "other";
  reason?: string;
};

export async function bookAppointment(params: BookAppointmentParams): Promise<string> {
  const env = getEnv();
  const phone = normalisePhone(params.phone);

  const { customerId } = await createOrFindCustomer(phone, params.customer_name);
  const { petId } = await createOrFindPet(customerId, params.pet_name, params.pet_species);

  const { data, error } = await getSupabase()
    .from("appointments")
    .insert({
      clinic_id: env.AGENT_CLINIC_ID,
      customer_id: customerId,
      pet_id: petId,
      appointment_type: params.visit_type,
      status: "scheduled",
      source: "phone",
      scheduled_at: params.scheduled_at,
      duration_minutes: 30,
      reason: params.reason ?? null,
    })
    .select("id, scheduled_at")
    .single();

  if (error) {
    // GIST overlap violation
    if (error.code === "23P01" || error.message.includes("appointments_no_active_overlap")) {
      return "השעה הזו כבר תפוסה. בחר/י שעה אחרת מהחלונות הפנויים.";
    }
    throw new Error(`bookAppointment failed: ${error.message}`);
  }

  const scheduledAt = typeof data.scheduled_at === "string" ? data.scheduled_at : params.scheduled_at;
  const slotLabel = formatSlotLabel(scheduledAt);
  const dateLabel = scheduledAt.slice(0, 10);
  return (
    `✅ תור נקבע: ${formatDateHe(dateLabel)} בשעה ${slotLabel} ` +
    `עבור ${params.pet_name}. אשלח תזכורת SMS 24 שעות לפני.`
  );
}

export async function cancelAppointment(phone: string, scheduledAt: string): Promise<string> {
  const env = getEnv();
  const normalised = normalisePhone(phone);

  const customerId = await findCustomerIdByPhone(normalised);
  if (!customerId) return "לא מצאנו לקוח עם מספר הטלפון הזה.";

  const appt = await findActiveAppointmentNear(env.AGENT_CLINIC_ID, customerId, scheduledAt);
  if (!appt) return "לא מצאנו תור פעיל בשעה הזו. ייתכן שכבר בוטל.";

  const { error: cancelErr } = await getSupabase()
    .from("appointments")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", appt.id);

  if (cancelErr) throw new Error(`cancelAppointment update failed: ${cancelErr.message}`);

  return `✅ התור בשעה ${formatSlotLabel(appt.scheduled_at)} בוטל בהצלחה.`;
}

export async function rescheduleAppointment(
  phone: string,
  currentScheduledAt: string,
  newScheduledAt: string,
): Promise<string> {
  const env = getEnv();
  const normalised = normalisePhone(phone);

  const customerId = await findCustomerIdByPhone(normalised);
  if (!customerId) return "לא מצאנו לקוח עם מספר הטלפון הזה.";

  const oldAppt = await findActiveAppointmentNear(env.AGENT_CLINIC_ID, customerId, currentScheduledAt);
  if (!oldAppt) return "לא מצאנו תור פעיל בשעה הזו. ייתכן שכבר בוטל.";

  const { error: rpcErr } = await getSupabase().rpc("reschedule_appointment", {
    p_clinic_id: env.AGENT_CLINIC_ID,
    p_old_appointment_id: oldAppt.id,
    p_new_scheduled_at: newScheduledAt,
    p_duration_minutes: 30,
  });

  if (rpcErr) {
    if (rpcErr.message.includes("appointments_no_active_overlap") || rpcErr.code === "23P01") {
      return "השעה החדשה כבר תפוסה. בחר/י שעה אחרת.";
    }
    throw new Error(`rescheduleAppointment rpc failed: ${rpcErr.message}`);
  }

  const oldLabel = formatSlotLabel(oldAppt.scheduled_at);
  const newLabel = formatSlotLabel(newScheduledAt);
  const newDate = newScheduledAt.slice(0, 10);
  return `✅ התור הוזז בהצלחה מ-${oldLabel} ל-${formatDateHe(newDate)} בשעה ${newLabel}.`;
}

async function findActiveAppointmentNear(
  clinicId: string,
  customerId: string,
  scheduledAt: string,
): Promise<AppointmentRow | null> {
  const target = new Date(scheduledAt);
  if (isNaN(target.getTime())) return null;

  const rangeStart = new Date(target.getTime() - 2 * 60 * 1000).toISOString();
  const rangeEnd = new Date(target.getTime() + 2 * 60 * 1000).toISOString();

  const { data, error } = await getSupabase()
    .from("appointments")
    .select("id, scheduled_at")
    .eq("clinic_id", clinicId)
    .eq("customer_id", customerId)
    .in("status", ["scheduled", "confirmed"])
    .is("deleted_at", null)
    .gte("scheduled_at", rangeStart)
    .lte("scheduled_at", rangeEnd)
    .limit(1);

  if (error) throw new Error(`findActiveAppointmentNear failed: ${error.message}`);
  if (!data || data.length === 0) return null;

  const row = data[0];
  const id = extractId(row);
  const scheduled_at = typeof (row as Record<string, unknown>)["scheduled_at"] === "string"
    ? (row as Record<string, unknown>)["scheduled_at"] as string
    : null;

  if (!id || !scheduled_at) return null;
  return { id, scheduled_at };
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
        clinic_id: env.AGENT_CLINIC_ID,
        elevenlabs_conversation_id: conversationId,
        direction: "inbound",
        status,
        duration_seconds: durationSeconds,
        from_number: callerNumber,
        to_number: env.TWILIO_PHONE_NUMBER,
        agent_name: "tomer",
        metadata: payload,
      },
      { onConflict: "elevenlabs_conversation_id" },
    );
  if (error) throw new Error(`supabase voice_call upsert failed: ${error.message}`);
}
