// Slot availability logic for Get A Vet clinic (Israel time UTC+3)
// DST note: Israel is UTC+3 in summer, UTC+2 in winter. MVP uses fixed +03:00.

export type DayHours = {
  start: { h: number; m: number };
  end: { h: number; m: number };
};

export type VisitType =
  | "checkup"
  | "home_visit"
  | "vaccination"
  | "phone_consultation"
  | "neutering"
  | "consultation"
  | "urgent"
  | "follow_up"
  | "other";

export type VisitTypeConfig = {
  durationMin: number;
  bufferMin: number;
  requiresApproval: boolean;
  labelHe: string;
};

// effectiveDuration = durationMin + bufferMin; stored in duration_minutes so
// the GIST constraint in the DB automatically enforces inter-appointment gaps.
export const VISIT_TYPE_CONFIG: Record<VisitType, VisitTypeConfig> = {
  checkup:            { durationMin: 30, bufferMin: 10, requiresApproval: false, labelHe: "בדיקה בקליניקה" },
  home_visit:         { durationMin: 60, bufferMin: 30, requiresApproval: false, labelHe: "ביקור בית" },
  vaccination:        { durationMin: 20, bufferMin: 10, requiresApproval: false, labelHe: "חיסונים" },
  phone_consultation: { durationMin: 20, bufferMin:  0, requiresApproval: false, labelHe: "ייעוץ טלפוני" },
  neutering:          { durationMin: 30, bufferMin: 10, requiresApproval: true,  labelHe: "עיקור/סירוס" },
  consultation:       { durationMin: 20, bufferMin: 10, requiresApproval: false, labelHe: "ייעוץ" },
  urgent:             { durationMin: 30, bufferMin: 10, requiresApproval: false, labelHe: "דחוף" },
  follow_up:          { durationMin: 20, bufferMin: 10, requiresApproval: false, labelHe: "ביקור מעקב" },
  other:              { durationMin: 30, bufferMin: 10, requiresApproval: false, labelHe: "אחר" },
};

export function getVisitConfig(visitType: VisitType): VisitTypeConfig {
  return VISIT_TYPE_CONFIG[visitType] ?? VISIT_TYPE_CONFIG.other;
}

export function effectiveDuration(visitType: VisitType): number {
  const c = getVisitConfig(visitType);
  return c.durationMin + c.bufferMin;
}

// Sunday=0 … Friday=5 … Saturday=6 (JS Date.getDay())
const HOURS_BY_DAY: Record<number, DayHours | null> = {
  0: { start: { h: 8, m:  0 }, end: { h: 20, m: 0 } }, // Sunday
  1: { start: { h: 8, m:  0 }, end: { h: 20, m: 0 } }, // Monday
  2: { start: { h: 8, m:  0 }, end: { h: 20, m: 0 } }, // Tuesday
  3: { start: { h: 8, m:  0 }, end: { h: 20, m: 0 } }, // Wednesday
  4: { start: { h: 8, m:  0 }, end: { h: 20, m: 0 } }, // Thursday
  5: { start: { h: 8, m: 30 }, end: { h: 13, m: 0 } }, // Friday
  6: null,                                               // Saturday — closed
};

const HE_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export const ISRAEL_TZ_OFFSET = "+03:00";
const SLOT_GRANULARITY_MIN = 10; // GCD of 20, 30 — candidate start times every 10 min
const MAX_SLOTS_TO_SHOW = 6;
const MAX_BOOKING_DAYS_AHEAD = 14;
const LATE_CANCEL_HOURS = 4;

export function getClinicHours(dateIso: string): DayHours | null {
  const d = new Date(`${dateIso}T12:00:00${ISRAEL_TZ_OFFSET}`);
  return HOURS_BY_DAY[d.getDay()] ?? null;
}

export function getDayNameHe(dateIso: string): string {
  const d = new Date(`${dateIso}T12:00:00${ISRAEL_TZ_OFFSET}`);
  return HE_DAYS[d.getDay()] ?? "";
}

/** Returns false if dateIso is more than 14 days from today (Israel time). */
export function isWithin14Days(dateIso: string): boolean {
  const now = new Date();
  const todayIso = toIsraelDateIso(now);
  const todayMs = new Date(`${todayIso}T00:00:00${ISRAEL_TZ_OFFSET}`).getTime();
  const targetMs = new Date(`${dateIso}T00:00:00${ISRAEL_TZ_OFFSET}`).getTime();
  const diffDays = (targetMs - todayMs) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= MAX_BOOKING_DAYS_AHEAD;
}

/** Returns true if cancelling now is within LATE_CANCEL_HOURS of the appointment. */
export function isTooLateToCancel(scheduledAtIso: string): boolean {
  const apptMs = new Date(scheduledAtIso).getTime();
  const nowMs = Date.now();
  const hoursUntil = (apptMs - nowMs) / (1000 * 60 * 60);
  return hoursUntil < LATE_CANCEL_HOURS;
}

/**
 * Returns the latest date (YYYY-MM-DD, Israel time) Tomer can book appointments for.
 * Used in responses like "אפשר לקבוע עד X".
 */
export function maxBookingDateIso(): string {
  const now = new Date();
  const ms = now.getTime() + MAX_BOOKING_DAYS_AHEAD * 24 * 60 * 60 * 1000;
  return toIsraelDateIso(new Date(ms));
}

function toIsraelDateIso(d: Date): string {
  // Shift by +3h, then slice the date part
  const shifted = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Generate candidate slot start times for a given day and visit type.
 * Granularity: SLOT_GRANULARITY_MIN (10 min).
 * A slot is valid if [start, start + effectiveDuration) fits within clinic hours.
 * Already-booked time ranges (as {start, end} pairs) are excluded.
 */
export function generateSlotsForVisitType(
  dateIso: string,
  hours: DayHours,
  visitType: VisitType,
  bookedRanges: Array<{ start: string; end: string }>,
): string[] {
  const durationMin = effectiveDuration(visitType);

  const dayStartMin = hours.start.h * 60 + hours.start.m;
  const dayEndMin   = hours.end.h   * 60 + hours.end.m;

  // Latest a slot can start: end of day minus the full effective duration
  const latestStartMin = dayEndMin - durationMin;

  const booked = bookedRanges.map((r) => ({
    startMs: new Date(r.start).getTime(),
    endMs:   new Date(r.end).getTime(),
  }));

  const slots: string[] = [];
  let cursor = dayStartMin;

  while (cursor <= latestStartMin && slots.length < MAX_SLOTS_TO_SHOW) {
    const slotStartMs = new Date(`${dateIso}T${minToHHMM(cursor)}:00${ISRAEL_TZ_OFFSET}`).getTime();
    const slotEndMs   = slotStartMs + durationMin * 60 * 1000;

    const overlaps = booked.some(
      (b) => slotStartMs < b.endMs && slotEndMs > b.startMs,
    );

    if (!overlaps) {
      slots.push(`${dateIso}T${minToHHMM(cursor)}:00${ISRAEL_TZ_OFFSET}`);
    }

    cursor += SLOT_GRANULARITY_MIN;
  }

  return slots;
}

export function formatSlotLabel(iso: string): string {
  const match = iso.match(/T(\d{2}):(\d{2})/);
  if (!match) return iso;
  return `${match[1]}:${match[2]}`;
}

export function formatDateHe(dateIso: string): string {
  const [year, month, day] = dateIso.split("-");
  return `${day}/${month}/${year}`;
}

export function toIso(dateIso: string, hours: number, minutes: number): string {
  return `${dateIso}T${minToHHMM(hours * 60 + minutes)}:00${ISRAEL_TZ_OFFSET}`;
}

function minToHHMM(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
