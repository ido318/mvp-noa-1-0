import type { AppointmentType } from "@/types/domain/appointment";
import { ISRAEL_TIMEZONE, israelDayOfWeek, israelLocalToUtcIso } from "@tomer/shared";

export const CLINIC_TIMEZONE = ISRAEL_TIMEZONE;

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
  const weekday = israelDayOfWeek(date);
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
  return israelLocalToUtcIso(date, Number(hourRaw), Number(minuteRaw));
}
