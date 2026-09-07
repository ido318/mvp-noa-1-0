import { getSupabase } from "./supabase.js";
import { logger } from "./logger.js";
import { sendSms } from "./sms.service.js";
import { isQuietHours, nextSendableTime } from "./notifications.js";

export type ProcessResult = {
  processed: number;
  sent: number;
  failed: number;
  deferred: number;
  /** Rows whose moment has passed; marked 'skipped' rather than sent late. */
  expired: number;
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

// Rows stuck in 'processing' for longer than this are considered crashed and reset.
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// A reminder is only useful near the moment it describes. If the processor was
// down — as it was for weeks while every cron run failed on a missing function —
// the backlog must not be delivered on recovery: nobody wants a "your
// appointment is today at 09:00" for an appointment two weeks past, and a
// post-visit follow-up that arrives a fortnight late reads as neglect. Anything
// overdue by more than this is closed out as 'skipped'.
const EXPIRY_MS = 12 * 60 * 60 * 1000; // 12 hours

export async function processNotifications(opts: ProcessOptions = {}): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, sent: 0, failed: 0, deferred: 0, expired: 0 };
  const now = new Date();
  const nowIso = now.toISOString();

  // ── Recovery: reset rows stuck in 'processing' (crashed processor) ─────
  const staleThreshold = new Date(now.getTime() - PROCESSING_TIMEOUT_MS).toISOString();
  const { error: recoveryErr } = await getSupabase()
    .from("notifications_log")
    .update({ status: "pending", updated_at: nowIso })
    .eq("status", "processing")
    .lt("updated_at", staleThreshold);
  if (recoveryErr) {
    logger.error({ error: recoveryErr.message }, "Stuck-row recovery failed — processing rows may remain stuck");
  }

  // ── Expiry: close out rows whose moment has passed ─────────────────────
  const expiryThreshold = new Date(now.getTime() - EXPIRY_MS).toISOString();
  let expireQuery = getSupabase()
    .from("notifications_log")
    .update({ status: "skipped", error: "expired: scheduled_for passed by more than 12h", updated_at: nowIso })
    .eq("status", "pending")
    .lt("scheduled_for", expiryThreshold)
    .select("id");

  if (opts.appointmentId) expireQuery = expireQuery.eq("appointment_id", opts.appointmentId);
  if (opts.clinicId)      expireQuery = expireQuery.eq("clinic_id", opts.clinicId);

  const { data: expired, error: expireErr } = await expireQuery;
  if (expireErr) {
    logger.error({ error: expireErr.message }, "Expiry sweep failed — stale rows may be sent late");
  } else if (expired && expired.length > 0) {
    result.expired = expired.length;
    logger.warn({ expired: expired.length }, "Skipped notifications whose scheduled time had passed");
  }

  // ── Quiet hours: bulk defer all pending rows ───────────────────────────
  if (isQuietHours(now)) {
    const deferUntil = nextSendableTime(now).toISOString();
    let deferQuery = getSupabase()
      .from("notifications_log")
      .update({ scheduled_for: deferUntil, updated_at: nowIso })
      .eq("status", "pending")
      .lte("scheduled_for", nowIso)
      .select("id");

    if (opts.appointmentId) deferQuery = deferQuery.eq("appointment_id", opts.appointmentId);
    if (opts.clinicId)      deferQuery = deferQuery.eq("clinic_id", opts.clinicId);

    const { data: deferred, error: deferErr } = await deferQuery;
    if (deferErr) {
      logger.error({ error: deferErr.message }, "Bulk defer failed");
    } else {
      result.deferred = deferred?.length ?? 0;
    }
    return result;
  }

  // ── Atomic claim: UPDATE status='processing' RETURNING * ───────────────
  // PostgreSQL evaluates the WHERE and UPDATE atomically; two concurrent
  // processors will each claim a disjoint set of rows.
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
      const { sid } = await sendSms(row.phone, row.body);

      // Guarded on status='processing' (not just id) so a cancelFutureNotifications
      // call that raced this send and already flipped the row to 'skipped'
      // isn't silently clobbered back to 'sent' — it's a no-op instead.
      const { error: sentErr } = await getSupabase()
        .from("notifications_log")
        .update({ status: "sent", sent_at: nowIso, twilio_message_sid: sid, updated_at: nowIso })
        .eq("id", row.id)
        .eq("status", "processing");

      if (sentErr) {
        // SMS was delivered but we failed to record it. The 5-min recovery
        // will reset this row to 'pending', risking a duplicate send. Log at
        // error level so on-call can investigate.
        logger.error(
          { id: row.id, error: sentErr.message },
          "SMS delivered but status update to 'sent' failed — row will recover in 5 min",
        );
      }
      result.sent++;
    } catch (sendErr) {
      const message = sendErr instanceof Error ? sendErr.message : String(sendErr);
      logger.error({ id: row.id, type: row.type, error: message }, "Failed to send SMS");

      // Same guard as the 'sent' update above.
      const { error: failedErr } = await getSupabase()
        .from("notifications_log")
        .update({ status: "failed", error: message, updated_at: nowIso })
        .eq("id", row.id)
        .eq("status", "processing");

      if (failedErr) {
        logger.error(
          { id: row.id, error: failedErr.message },
          "SMS failed but status update to 'failed' failed — row will recover in 5 min",
        );
      }
      result.failed++;
    }
  }

  return result;
}
