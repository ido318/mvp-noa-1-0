import { getSupabase } from "./supabase.js";
import { getEnv } from "./env.js";
import { logger } from "./logger.js";
import {
  smsTemplates,
  formatAppointmentDateTime,
  CLINIC_LOCATION,
  HOME_VISIT_LOCATION,
  type BookingConfirmationData,
  type MorningReminderData,
} from "../services/sms.templates.js";
import { getVisitConfig, type VisitType } from "./appointments.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationType =
  | "booking_confirmation"
  | "morning_reminder"
  | "arrival_reminder"
  | "post_visit_followup"
  | "reschedule_update"
  | "cancellation_update"
  | "client_cancellation_confirmation";

// Price per visit type (displayed in booking_confirmation SMS)
const VISIT_PRICE: Record<VisitType, string> = {
  checkup:            "150",
  home_visit:         "300",
  vaccination:        "150",
  phone_consultation: "200",
  neutering:          "350",
  consultation:       "150",
  urgent:             "200",
  follow_up:          "150",
  other:              "150",
};

// ─────────────────────────────────────────────────────────────────────────────
// Jerusalem timezone helpers (DST-correct via Intl — no fixed offset)
// ─────────────────────────────────────────────────────────────────────────────

function israelHour(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    hour: "numeric",
    hour12: false,
  }).formatToParts(d);
  return parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
}

/** Returns the date portion (YYYY-MM-DD) in Israel timezone. */
export function israelDateIso(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Returns true if `now` falls in quiet hours (21:00–07:59 Israel time). */
export function isQuietHours(now: Date): boolean {
  const h = israelHour(now);
  return h >= 21 || h < 8;
}

/**
 * Returns the UTC Date representing 08:00 Israel time for `dateIso` (YYYY-MM-DD).
 * Israel is UTC+2 (winter) or UTC+3 (summer); Intl handles DST automatically.
 */
export function morningReminderTime(dateIso: string): Date {
  // Try UTC 05:00 (= 08:00 Israel UTC+3 summer) then 06:00 (= 08:00 Israel UTC+2 winter)
  for (const utcHour of [5, 6]) {
    const candidate = new Date(`${dateIso}T${String(utcHour).padStart(2, "0")}:00:00Z`);
    if (israelHour(candidate) === 8) return candidate;
  }
  return new Date(`${dateIso}T05:00:00Z`); // fallback (should never be reached)
}

/**
 * If `now` is in quiet hours, returns 08:00 Israel time on the next morning.
 * Otherwise returns `now` unchanged.
 */
export function nextSendableTime(now: Date): Date {
  if (!isQuietHours(now)) return now;

  const todayIso = israelDateIso(now);
  const todayMorning = morningReminderTime(todayIso);
  if (todayMorning > now) return todayMorning;

  // todayMorning is already past → next morning
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return morningReminderTime(israelDateIso(tomorrow));
}

// ─────────────────────────────────────────────────────────────────────────────
// SMS body builders
// ─────────────────────────────────────────────────────────────────────────────

function buildBaseParams(
  scheduledAt: string,
  visitType: VisitType,
  customerName: string,
  petName: string,
): BookingConfirmationData & MorningReminderData {
  const { dayName, date, time } = formatAppointmentDateTime(scheduledAt);
  const config = getVisitConfig(visitType);
  return {
    customerName,
    petName,
    dayName,
    date,
    time,
    location: visitType === "home_visit" ? HOME_VISIT_LOCATION : CLINIC_LOCATION,
    visitType: config.labelHe,
    price: VISIT_PRICE[visitType],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Enqueue (idempotent via UNIQUE(appointment_id, type))
// ─────────────────────────────────────────────────────────────────────────────

type EnqueueParams = {
  clinicId: string;
  customerId: string;
  appointmentId: string;
  phone: string;
  type: NotificationType;
  body: string;
  scheduledFor: Date;
};

export async function enqueueNotification(params: EnqueueParams): Promise<void> {
  const { error } = await getSupabase()
    .from("notifications_log")
    .upsert(
      {
        clinic_id:      params.clinicId,
        customer_id:    params.customerId,
        appointment_id: params.appointmentId,
        phone:          params.phone,
        type:           params.type,
        body:           params.body,
        scheduled_for:  params.scheduledFor.toISOString(),
        status:         "pending",
      },
      { onConflict: "appointment_id,type", ignoreDuplicates: true },
    );
  if (error) throw new Error(`enqueueNotification failed (${params.type}): ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// High-level scheduling helpers
// ─────────────────────────────────────────────────────────────────────────────

export type BookingNotificationParams = {
  appointmentId: string;
  scheduledAt: string;   // ISO with timezone
  durationMinutes: number;
  visitType: VisitType;
  clinicId: string;
  customerId: string;
  phone: string;
  customerName: string;
  petName: string;
};

/** Enqueue booking_confirmation (now), morning_reminder (08:00 day-of), post_visit_followup (end+24h). */
export async function scheduleBookingNotifications(p: BookingNotificationParams): Promise<void> {
  const now = new Date();
  const base = buildBaseParams(p.scheduledAt, p.visitType, p.customerName, p.petName);
  const shared = {
    clinicId:      p.clinicId,
    customerId:    p.customerId,
    appointmentId: p.appointmentId,
    phone:         p.phone,
  };

  await enqueueNotification({
    ...shared,
    type:         "booking_confirmation",
    body:         smsTemplates.booking_confirmation(base),
    scheduledFor: now,
  });

  const appointmentDateIso = israelDateIso(new Date(p.scheduledAt));
  const morning = morningReminderTime(appointmentDateIso);
  if (morning > now) {
    await enqueueNotification({
      ...shared,
      type:         "morning_reminder",
      body:         smsTemplates.morning_reminder(base),
      scheduledFor: morning,
    });
  }

  const arrivalReminderTime = new Date(new Date(p.scheduledAt).getTime() - 2 * 60 * 60_000);
  if (arrivalReminderTime > now) {
    await enqueueNotification({
      ...shared,
      type:         "arrival_reminder",
      body:         smsTemplates.arrival_reminder(base),
      scheduledFor: arrivalReminderTime,
    });
  }

  const followupTime = new Date(
    new Date(p.scheduledAt).getTime() + p.durationMinutes * 60_000 + 24 * 60 * 60_000,
  );
  await enqueueNotification({
    ...shared,
    type:         "post_visit_followup",
    body:         smsTemplates.post_visit_followup({ customerName: p.customerName, petName: p.petName }),
    scheduledFor: followupTime,
  });
}

/** Skip all pending future notifications for a given appointment. */
export async function cancelFutureNotifications(
  appointmentId: string,
  clinicId: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from("notifications_log")
    .update({ status: "skipped", updated_at: new Date().toISOString() })
    .eq("appointment_id", appointmentId)
    .eq("clinic_id", clinicId)
    .eq("status", "pending");
  if (error) throw new Error(`cancelFutureNotifications failed: ${error.message}`);
}

export type ClientCancellationParams = {
  appointmentId: string;
  scheduledAt: string;
  clinicId: string;
  customerId: string;
  phone: string;
  customerName: string;
  petName: string;
};

export type RescheduleNotificationParams = {
  appointmentId: string;
  oldScheduledAt: string;
  newScheduledAt: string;
  durationMinutes: number;
  visitType: VisitType;
  clinicId: string;
  customerId: string;
  phone: string;
  customerName: string;
  petName: string;
};

/**
 * Used when the dashboard reschedules an appointment via TypeScript code
 * (complementary to the DB trigger, which fires the same SQL path).
 * ON CONFLICT DO NOTHING ensures the trigger's row wins if it lands first.
 */
export async function enqueueRescheduleNotification(
  p: RescheduleNotificationParams,
): Promise<void> {
  const { date: oldDate } = formatAppointmentDateTime(p.oldScheduledAt);
  const { date: newDate, time: newTime } = formatAppointmentDateTime(p.newScheduledAt);
  const location = p.visitType === "home_visit" ? HOME_VISIT_LOCATION : CLINIC_LOCATION;

  await enqueueNotification({
    clinicId:      p.clinicId,
    customerId:    p.customerId,
    appointmentId: p.appointmentId,
    phone:         p.phone,
    type:          "reschedule_update",
    body:          smsTemplates.reschedule_update({
      customerName: p.customerName,
      petName:      p.petName,
      oldDate,
      newDate,
      newTime,
      location,
    }),
    scheduledFor: new Date(),
  });
}

/** Cancel future notifications and enqueue client_cancellation_confirmation immediately. */
export async function enqueueClientCancellationConfirmation(
  p: ClientCancellationParams,
): Promise<void> {
  await cancelFutureNotifications(p.appointmentId, p.clinicId);

  const { date } = formatAppointmentDateTime(p.scheduledAt);
  await enqueueNotification({
    clinicId:      p.clinicId,
    customerId:    p.customerId,
    appointmentId: p.appointmentId,
    phone:         p.phone,
    type:          "client_cancellation_confirmation",
    body:          smsTemplates.client_cancellation_confirmation({
      customerName: p.customerName,
      petName:      p.petName,
      oldDate:      date,
    }),
    scheduledFor: new Date(),
  });
}
