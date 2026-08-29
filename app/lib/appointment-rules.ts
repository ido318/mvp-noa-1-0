import type { AppointmentType } from "@/types/domain/appointment";

export const CLINIC_TIMEZONE = "Asia/Jerusalem";

export type VisitTypeConfig = {
  durationMin: number;
  bufferMin: number;
  requiresApproval: boolean;
  labelHe: string;
};

export const VISIT_TYPE_CONFIG: Record<AppointmentType, VisitTypeConfig> = {
  checkup: { durationMin: 30, bufferMin: 10, requiresApproval: false, labelHe: "בדיקה בקליניקה" },
  home_visit: { durationMin: 60, bufferMin: 30, requiresApproval: false, labelHe: "ביקור בית" },
  vaccination: { durationMin: 20, bufferMin: 10, requiresApproval: false, labelHe: "חיסונים" },
  phone_consultation: { durationMin: 20, bufferMin: 0, requiresApproval: false, labelHe: "ייעוץ טלפוני" },
  neutering: { durationMin: 30, bufferMin: 10, requiresApproval: true, labelHe: "עיקור/סירוס" },
  consultation: { durationMin: 20, bufferMin: 10, requiresApproval: false, labelHe: "ייעוץ" },
  urgent: { durationMin: 30, bufferMin: 0, requiresApproval: false, labelHe: "דחוף" },
  follow_up: { durationMin: 30, bufferMin: 0, requiresApproval: false, labelHe: "ביקור מעקב" },
  other: { durationMin: 30, bufferMin: 0, requiresApproval: false, labelHe: "אחר" },
};

export function effectiveDuration(type: AppointmentType): number {
  const config = VISIT_TYPE_CONFIG[type] ?? VISIT_TYPE_CONFIG.other;
  return config.durationMin + config.bufferMin;
}

export function isExpectedDuration(type: AppointmentType, durationMinutes: number): boolean {
  return durationMinutes === effectiveDuration(type);
}

export function getClinicHoursForDate(date: string): { open: string; close: string } | null {
  const weekday = dayOfWeekInIsrael(date);
  if (weekday >= 0 && weekday <= 4) return { open: "08:00", close: "20:00" };
  if (weekday === 5) return { open: "08:30", close: "13:00" };
  return null;
}

export const BOOKING_WINDOW_DAYS = 14;

export function getBookableDates(fromDate: string): string[] {
  const [year = 0, month = 1, day = 1] = fromDate.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  return Array.from({ length: BOOKING_WINDOW_DAYS }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export function toIsraelLocalIso(date: string, hhmm: string): string {
  const [hourRaw, minuteRaw] = hhmm.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  return `${date}T${hhmm}:00${israelOffsetForLocalDateTime(date, hour, minute)}`;
}

function dayOfWeekInIsrael(date: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIMEZONE,
    weekday: "short",
  }).format(new Date(toIsraelLocalIso(date, "12:00")));
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? 0;
}

function israelOffsetForLocalDateTime(
  date: string,
  hour: number,
  minute: number,
): string {
  const hhmm = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  for (const offset of ["+02:00", "+03:00"]) {
    const candidate = new Date(`${date}T${hhmm}:00${offset}`);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: CLINIC_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(candidate);
    const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    if (`${value("year")}-${value("month")}-${value("day")}` === date) {
      if (`${value("hour")}:${value("minute")}` === hhmm) return offset;
    }
  }
  return "+02:00";
}
