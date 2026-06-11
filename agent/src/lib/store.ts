import { getSupabase } from "./supabase.js";
import { getEnv } from "./env.js";

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
