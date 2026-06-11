import { getSupabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";
import { sendSms } from "../lib/sms.service.js";
import { isQuietHours, nextSendableTime } from "../lib/notifications.js";

export type ProcessResult = {
  processed: number;
  sent: number;
  failed: number;
  deferred: number;
};

type ProcessOptions = {
  appointmentId?: string;
  clinicId?: string;
};

type NotificationRow = {
  id: string;
  clinic_id: string;
  phone: string;
  body: string;
  type: string;
  appointment_id: string;
};

export async function processNotifications(opts: ProcessOptions = {}): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, sent: 0, failed: 0, deferred: 0 };
  const now = new Date();
  const nowIso = now.toISOString();

  // ── Quiet hours: defer all pending rows in one bulk UPDATE ──────────────
  if (isQuietHours(now)) {
    const deferUntil = nextSendableTime(now).toISOString();
    let deferQuery = getSupabase()
      .from("notifications_log")
      .update({ scheduled_for: deferUntil, updated_at: nowIso })
      .eq("status", "pending")
      .lte("scheduled_for", nowIso);

    if (opts.appointmentId) deferQuery = deferQuery.eq("appointment_id", opts.appointmentId);
    if (opts.clinicId)      deferQuery = deferQuery.eq("clinic_id", opts.clinicId);

    const { error } = await deferQuery;
    if (error) logger.error({ error: error.message }, "Bulk defer failed");
    return result; // deferred count not tracked for bulk path — zero is fine
  }

  // ── Atomic claim: UPDATE status='processing' … RETURNING * ─────────────
  // Prevents two concurrent processor runs from sending the same SMS twice.
  let claimQuery = getSupabase()
    .from("notifications_log")
    .update({ status: "processing", updated_at: nowIso })
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .select("id, clinic_id, phone, body, type, appointment_id");

  if (opts.appointmentId) claimQuery = claimQuery.eq("appointment_id", opts.appointmentId);
  if (opts.clinicId)      claimQuery = claimQuery.eq("clinic_id", opts.clinicId);

  const { data: rows, error: claimErr } = await claimQuery.returns<NotificationRow[]>();
  if (claimErr) throw new Error(`processNotifications claim failed: ${claimErr.message}`);
  if (!rows || rows.length === 0) return result;

  for (const row of rows) {
    result.processed++;
    try {
      await sendSms(row.phone, row.body);
      const { error: updateErr } = await getSupabase()
        .from("notifications_log")
        .update({ status: "sent", sent_at: nowIso, updated_at: nowIso })
        .eq("id", row.id);
      if (updateErr) {
        logger.error({ id: row.id, error: updateErr.message }, "Notification sent but status update failed");
      }
      result.sent++;
    } catch (sendErr) {
      const message = sendErr instanceof Error ? sendErr.message : String(sendErr);
      logger.error({ id: row.id, type: row.type, error: message }, "Failed to send SMS");
      await getSupabase()
        .from("notifications_log")
        .update({ status: "failed", error: message, updated_at: nowIso })
        .eq("id", row.id);
      result.failed++;
    }
  }

  return result;
}
