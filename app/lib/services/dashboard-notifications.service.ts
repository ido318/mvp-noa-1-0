/**
 * Enqueues SMS notifications from the dashboard into notifications_log.
 * Used by the approve/reject flow for pending_approval appointments.
 *
 * Templates are frozen — do not modify without Noa's approval.
 * (Same templates as agent/src/services/sms.templates.ts — kept in sync manually.)
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";

const TZ = "Asia/Jerusalem";

function israelDT(iso: string): { dayName: string; date: string; time: string } {
  const d = new Date(iso);

  const dayName = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, weekday: "long" }).format(d);
  const { day, month, year } = new Intl.DateTimeFormat("he-IL", {
    timeZone: TZ, day: "numeric", month: "numeric", year: "numeric",
  }).formatToParts(d).reduce<Record<string, string>>((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const date = `${day}.${month}.${year}`;
  const time = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

  return { dayName, date, time };
}

function israelDateIso(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function morningReminderTime(dateIso: string): Date {
  for (const utcHour of [5, 6]) {
    const candidate = new Date(`${dateIso}T${String(utcHour).padStart(2, "0")}:00:00Z`);
    const h = parseInt(
      new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).formatToParts(candidate).find(p => p.type === "hour")?.value ?? "0",
      10,
    );
    if (h === 8) return candidate;
  }
  return new Date(`${dateIso}T05:00:00Z`);
}

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

const CLINIC_LOCATION = 'הקליניקה, גרציאני 6 ת"א';
const HOME_LOCATION = "ביקור בית בכתובתכם";

function buildBookingConfirmationBody(p: {
  customerName: string; petName: string;
  dayName: string; date: string; time: string;
  location: string; visitType: string; price: string;
}): string {
  return (
    `שלום ${p.customerName}, כאן תומר ממרפאת Get A Vet של ד"ר נועה כבשני.\n` +
    `התור של ${p.petName} נקבע בהצלחה ✅\n` +
    `📅 ${p.dayName}, ${p.date} | 🕒 ${p.time} | 📍 ${p.location}\n` +
    `🩺 ${p.visitType} | 💳 ${p.price}\n` +
    `לשינוי או ביטול (חינם עד 4 שעות לפני התור) — חייגו אלינו.\n` +
    `מאחלים ל${p.petName} בריאות שלמה 🐾`
  );
}

function buildMorningReminderBody(p: {
  customerName: string; petName: string;
  time: string; location: string; visitType: string;
}): string {
  return (
    `בוקר טוב ${p.customerName} ☀️ תזכורת מ-Get A Vet:\n` +
    `היום 🕒 ${p.time} | ${p.visitType} ל${p.petName} | 📍 ${p.location}\n` +
    `אם משהו השתנה — חייגו אלינו בהקדם האפשרי.\n` +
    `מחכים לכם, תומר וד"ר נועה 🐾`
  );
}

function buildPostVisitFollowupBody(customerName: string, petName: string): string {
  return (
    `שלום ${customerName}, כאן תומר מ-Get A Vet 🐾\n` +
    `רצינו לשאול מה שלום ${petName} אחרי הביקור אצל ד"ר נועה — האם המצב משתפר?\n` +
    `אם יש שאלות, החמרה או כל דבר אחר — אנחנו זמינים בטלפון.\n` +
    `החלמה מהירה ל${petName} ❤️`
  );
}

function buildCancellationUpdateBody(customerName: string, petName: string, oldDate: string): string {
  return (
    `שלום ${customerName}, עדכון מ-Get A Vet:\n` +
    `בשל אילוץ רפואי, התור של ${petName} מיום ${oldDate} בוטל.\n` +
    `נשמח לתאם מועד חדש — חייגו אלינו ונמצא זמן שנוח לכם.\n` +
    `מתנצלים על אי הנוחות 🙏 תומר, Get A Vet`
  );
}

// Mirrors agent/src/services/sms.templates.ts's vaccination_reminder exactly.
// Deliberately does not mention a specific due date (unlike this file's other
// build*Body helpers) — the frozen template only says "בקרוב" (soon).
function buildVaccinationReminderBody(customerName: string, petName: string, vaccineName: string): string {
  return (
    `שלום ${customerName}, כאן תומר מ-Get A Vet 💉\n` +
    `הגיע הזמן לחיסון הבא של ${petName} (${vaccineName}) — מומלץ לתאם בקרוב לשמירה על הבריאות.\n` +
    `לתיאום תור נוח — חייגו אלינו בכל עת.\n` +
    `בריאות ל${petName} 🐾 תומר, Get A Vet`
  );
}

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
    const { dayName, date, time } = israelDT(p.scheduledAt);
    const isHome = p.visitType === "home_visit";
    const location = isHome ? HOME_LOCATION : CLINIC_LOCATION;
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
        body:          buildBookingConfirmationBody({ customerName: p.customerName, petName: p.petName, dayName, date, time, location, visitType: visitTypeLabel, price }),
        scheduled_for: now.toISOString(),
      },
    ];

    const dateIso = israelDateIso(p.scheduledAt);
    const morning = morningReminderTime(dateIso);
    if (morning > now) {
      rows.push({
        ...shared,
        type:          "morning_reminder",
        body:          buildMorningReminderBody({ customerName: p.customerName, petName: p.petName, time, location, visitType: visitTypeLabel }),
        scheduled_for: morning.toISOString(),
      });
    }

    const followupTime = new Date(new Date(p.scheduledAt).getTime() + p.durationMinutes * 60_000 + 24 * 60 * 60_000);
    rows.push({
      ...shared,
      type:          "post_visit_followup",
      body:          buildPostVisitFollowupBody(p.customerName, p.petName),
      scheduled_for: followupTime.toISOString(),
    });

    const { error } = await this.client.from("notifications_log").insert(rows);
    if (error) return err(AppError.externalProvider("Failed to enqueue approval notifications", error));
    return ok(undefined);
  }

  /** Enqueue cancellation_update for a rejected pending_approval appointment. */
  async enqueueRejectionNotification(p: RejectNotificationParams): Promise<Result<void>> {
    const { date } = israelDT(p.scheduledAt);

    const { error } = await this.client.from("notifications_log").insert({
      clinic_id:      p.clinicId,
      customer_id:    p.customerId,
      appointment_id: p.appointmentId,
      phone:          p.phone,
      status:         "pending",
      type:           "cancellation_update",
      body:           buildCancellationUpdateBody(p.customerName, p.petName, date),
      scheduled_for:  new Date().toISOString(),
    });

    if (error) return err(AppError.externalProvider("Failed to enqueue rejection notification", error));
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
        body: buildVaccinationReminderBody(p.customerName, p.petName, p.vaccineName),
        scheduled_for: `${p.nextDueAt}T06:00:00.000Z`,
      },
      { onConflict: "vaccination_id,type", ignoreDuplicates: true },
    );

    if (error) return err(AppError.externalProvider("Failed to enqueue vaccination reminder", error));
    return ok(undefined);
  }
}
