/**
 * Enqueues SMS notifications from the dashboard into notifications_log.
 * Used by the approve/reject flow for pending_approval appointments.
 *
 * Templates are frozen — do not modify without Noa's approval. Templates and
 * Jerusalem-time math come from @tomer/shared — the single source of truth
 * also used by agent/src/services/sms.templates.ts (a thin re-export), so
 * app and agent can no longer drift the way they did before. As a second
 * safety net, tests/unit/sms-template-parity.test.ts still calls this
 * service and compares its output against the agent's templates verbatim —
 * treat that test failing as "the @tomer/shared re-export broke," not a
 * fixture to update.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import {
  smsTemplates,
  resolveSmsTemplate,
  formatAppointmentDateTime,
  israelDateIso,
  israelDateAtHour,
  CLINIC_LOCATION,
  HOME_VISIT_LOCATION,
  type SmsTemplateKey,
} from "@tomer/shared";

const VISIT_LABELS: Record<string, string> = {
  checkup: "בדיקה",
  vaccination: "חיסון",
  vaccine: "חיסון",
  neutering: "עיקור/סירוס",
  home_visit: "ביקור בית",
  phone_consultation: "ייעוץ טלפוני",
  followup: "מעקב",
  surgery: "ניתוח",
  other: "ביקור",
};

// Whole segment, not just a number. Neutering has no fixed price — it depends on
// species, weight, age and medical state, and only Dr. Noa quotes it — so the
// approval SMS must not name one. Mirrors agent/src/lib/notifications.ts.
const NO_FIXED_PRICE_TEXT = 'המחיר יימסר על ידי ד"ר נועה';

const VISIT_PRICES: Record<string, string> = {
  checkup: "150 ₪",
  vaccination: "150 ₪",
  vaccine: "150 ₪",
  neutering: NO_FIXED_PRICE_TEXT,
  home_visit: "300 ₪",
  phone_consultation: "200 ₪",
  followup: "150 ₪",
  surgery: NO_FIXED_PRICE_TEXT,
  other: "150 ₪",
};

export interface ApproveNotificationParams {
  appointmentId: string;
  scheduledAt: string;
  durationMinutes: number;
  visitType: string;
  clinicId: string;
  customerId: string;
  phone: string;
  customerName: string;
  petName: string;
}

export interface RejectNotificationParams {
  appointmentId: string;
  scheduledAt: string;
  clinicId: string;
  customerId: string;
  phone: string;
  customerName: string;
  petName: string;
}

export interface DashboardChangeNotificationParams {
  clinicId: string;
  customerId: string;
  appointmentId: string;
  phone: string;
  customerName: string;
  petName: string;
  templateKey: Extract<SmsTemplateKey, "reschedule_update" | "cancellation_update">;
  oldScheduledAt: string;
  newScheduledAt?: string;
  location: string;
}

export interface VaccinationReminderParams {
  vaccinationId: string;
  clinicId: string;
  customerId: string;
  phone: string;
  customerName: string;
  petName: string;
  vaccineName: string;
  nextDueAt: string;
}

export class DashboardNotificationsService {
  constructor(private readonly client: SupabaseClient) {}

  /** Enqueue booking_confirmation + morning_reminder + post_visit_followup for an approved appointment. */
  async enqueueApprovalNotifications(p: ApproveNotificationParams): Promise<Result<void>> {
    const now = new Date();
    const { dayName, date, time } = formatAppointmentDateTime(p.scheduledAt);
    const isHome = p.visitType === "home_visit";
    const location = isHome ? HOME_VISIT_LOCATION : CLINIC_LOCATION;
    const visitTypeLabel = VISIT_LABELS[p.visitType] ?? p.visitType;
    const price = VISIT_PRICES[p.visitType] ?? "150 ₪";

    const shared = {
      clinic_id:      p.clinicId,
      customer_id:    p.customerId,
      appointment_id: p.appointmentId,
      phone:          p.phone,
      status:         "pending",
    };

    const rows = [
      {
        ...shared,
        type:          "booking_confirmation",
        body:          smsTemplates.booking_confirmation({ customerName: p.customerName, petName: p.petName, dayName, date, time, location, visitType: visitTypeLabel, price }),
        scheduled_for: now.toISOString(),
      },
    ];

    const dateIso = israelDateIso(p.scheduledAt);
    const morning = israelDateAtHour(dateIso, 8);
    if (morning > now) {
      rows.push({
        ...shared,
        type:          "morning_reminder",
        body:          smsTemplates.morning_reminder({ customerName: p.customerName, petName: p.petName, time, location, visitType: visitTypeLabel }),
        scheduled_for: morning.toISOString(),
      });
    }

    const followupTime = new Date(new Date(p.scheduledAt).getTime() + p.durationMinutes * 60_000 + 24 * 60 * 60_000);
    rows.push({
      ...shared,
      type:          "post_visit_followup",
      body:          smsTemplates.post_visit_followup({ customerName: p.customerName, petName: p.petName }),
      scheduled_for: followupTime.toISOString(),
    });

    const { error } = await this.client.from("notifications_log").insert(rows);
    if (error) return err(AppError.externalProvider("Failed to enqueue approval notifications", error));
    return ok(undefined);
  }

  /** Enqueue cancellation_update for a rejected pending_approval appointment. */
  async enqueueRejectionNotification(p: RejectNotificationParams): Promise<Result<void>> {
    const { date } = formatAppointmentDateTime(p.scheduledAt);

    const { error } = await this.client.from("notifications_log").insert({
      clinic_id:      p.clinicId,
      customer_id:    p.customerId,
      appointment_id: p.appointmentId,
      phone:          p.phone,
      status:         "pending",
      type:           "cancellation_update",
      body:           smsTemplates.cancellation_update({ customerName: p.customerName, petName: p.petName, oldDate: date }),
      scheduled_for:  new Date().toISOString(),
    });

    if (error) return err(AppError.externalProvider("Failed to enqueue rejection notification", error));
    return ok(undefined);
  }

  /** Reads clinics.settings.smsTemplates for one clinic. Empty object (not an
   * error) if the clinic has no overrides or the row can't be read — the
   * caller always has the hardcoded default to fall back to. */
  async getSmsTemplateOverrides(clinicId: string): Promise<Partial<Record<SmsTemplateKey, string>>> {
    const { data, error } = await this.client
      .from("clinics")
      .select("settings")
      .eq("id", clinicId)
      .single();
    if (error || !data) return {};
    return (data.settings?.smsTemplates as Partial<Record<SmsTemplateKey, string>> | undefined) ?? {};
  }

  /**
   * Enqueues the dashboard-initiated reschedule/cancellation SMS, respecting
   * any clinic override — replaces what appointments_notify_dashboard_change()
   * used to hardcode in SQL (see 20260915120000_remove_hardcoded_dashboard_sms.sql).
   */
  async enqueueDashboardChangeNotification(p: DashboardChangeNotificationParams): Promise<Result<void>> {
    const overrides = await this.getSmsTemplateOverrides(p.clinicId);
    const { date: oldDate } = formatAppointmentDateTime(p.oldScheduledAt);
    const newDateTime = p.newScheduledAt ? formatAppointmentDateTime(p.newScheduledAt) : null;

    const body = resolveSmsTemplate(p.templateKey, overrides[p.templateKey], {
      customerName: p.customerName,
      petName: p.petName,
      oldDate,
      newDate: newDateTime?.date,
      newTime: newDateTime?.time,
      location: p.location,
    });

    const { error } = await this.client.from("notifications_log").insert({
      clinic_id: p.clinicId,
      customer_id: p.customerId,
      appointment_id: p.appointmentId,
      phone: p.phone,
      status: "pending",
      type: p.templateKey,
      body,
      scheduled_for: new Date().toISOString(),
    });
    if (error) return err(AppError.externalProvider("Failed to enqueue dashboard change notification", error));
    return ok(undefined);
  }

  async enqueueVaccinationReminder(p: VaccinationReminderParams): Promise<Result<void>> {
    const { error } = await this.client.from("notifications_log").upsert(
      {
        clinic_id: p.clinicId,
        customer_id: p.customerId,
        vaccination_id: p.vaccinationId,
        phone: p.phone,
        status: "pending",
        type: "vaccination_reminder",
        body: smsTemplates.vaccination_reminder({ customerName: p.customerName, petName: p.petName, vaccineName: p.vaccineName }),
        scheduled_for: `${p.nextDueAt}T06:00:00.000Z`,
      },
      { onConflict: "vaccination_id,type", ignoreDuplicates: true },
    );

    if (error) return err(AppError.externalProvider("Failed to enqueue vaccination reminder", error));
    return ok(undefined);
  }
}
