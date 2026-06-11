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

  let query = getSupabase()
    .from("notifications_log")
    .select("id, clinic_id, phone, body, type, appointment_id")
    .eq("status", "pending")
    .lte("scheduled_for", now.toISOString());

  if (opts.appointmentId) query = query.eq("appointment_id", opts.appointmentId);
  if (opts.clinicId) query = query.eq("clinic_id", opts.clinicId);

  const { data: rows, error } = await query.returns<NotificationRow[]>();
  if (error) throw new Error(`processNotifications query failed: ${error.message}`);
  if (!rows || rows.length === 0) return result;

  for (const row of rows) {
    result.processed++;

    if (isQuietHours(now)) {
      const deferUntil = nextSendableTime(now);
      const { error: deferErr } = await getSupabase()
        .from("notifications_log")
        .update({ scheduled_for: deferUntil.toISOString(), updated_at: now.toISOString() })
        .eq("id", row.id);
      if (deferErr) {
        logger.error({ id: row.id, error: deferErr.message }, "Failed to defer notification");
        result.failed++;
      } else {
        result.deferred++;
      }
      continue;
    }

    try {
      await sendSms(row.phone, row.body);
      const { error: updateErr } = await getSupabase()
        .from("notifications_log")
        .update({ status: "sent", sent_at: now.toISOString(), updated_at: now.toISOString() })
        .eq("id", row.id);
      if (updateErr) {
        logger.error({ id: row.id, error: updateErr.message }, "Notification sent but failed to update status");
      }
      result.sent++;
    } catch (sendErr) {
      const message = sendErr instanceof Error ? sendErr.message : String(sendErr);
      logger.error({ id: row.id, type: row.type, error: message }, "Failed to send SMS");
      await getSupabase()
        .from("notifications_log")
        .update({ status: "failed", error: message, updated_at: now.toISOString() })
        .eq("id", row.id);
      result.failed++;
    }
  }

  return result;
}
