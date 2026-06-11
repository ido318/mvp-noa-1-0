// Slot availability logic for Get A Vet clinic (Israel time UTC+3)
// DST note: Israel is UTC+3 in summer, UTC+2 in winter. MVP uses fixed +03:00.

export type DayHours = {
  start: { h: number; m: number };
  end: { h: number; m: number };
};

// Sunday=0 … Friday=5 … Saturday=6 (JS Date.getDay())
const HOURS_BY_DAY: Record<number, DayHours | null> = {
  0: { start: { h: 8, m: 0 }, end: { h: 20, m: 0 } },  // Sunday
  1: { start: { h: 8, m: 0 }, end: { h: 20, m: 0 } },  // Monday
  2: { start: { h: 8, m: 0 }, end: { h: 20, m: 0 } },  // Tuesday
  3: { start: { h: 8, m: 0 }, end: { h: 20, m: 0 } },  // Wednesday
  4: { start: { h: 8, m: 0 }, end: { h: 20, m: 0 } },  // Thursday
  5: { start: { h: 8, m: 30 }, end: { h: 13, m: 0 } }, // Friday
  6: null,                                               // Saturday — closed
};

const HE_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const ISRAEL_TZ_OFFSET = "+03:00";
const SLOT_DURATION_MIN = 30;
const MAX_SLOTS_TO_SHOW = 8;

export function getClinicHours(dateIso: string): DayHours | null {
  const d = new Date(`${dateIso}T12:00:00${ISRAEL_TZ_OFFSET}`);
  return HOURS_BY_DAY[d.getDay()] ?? null;
}

export function getDayNameHe(dateIso: string): string {
  const d = new Date(`${dateIso}T12:00:00${ISRAEL_TZ_OFFSET}`);
  return HE_DAYS[d.getDay()] ?? "";
}

export function generateAllSlots(dateIso: string, hours: DayHours): string[] {
  const slots: string[] = [];
  let h = hours.start.h;
  let m = hours.start.m;
  while (h < hours.end.h || (h === hours.end.h && m < hours.end.m)) {
    slots.push(toIso(dateIso, h, m));
    m += SLOT_DURATION_MIN;
    if (m >= 60) { h++; m -= 60; }
  }
  return slots;
}

export function filterFreeSlots(
  allSlots: string[],
  takenIsos: string[],
): string[] {
  const taken = new Set(takenIsos.map(normaliseIso));
  return allSlots
    .filter((s) => !taken.has(normaliseIso(s)))
    .slice(0, MAX_SLOTS_TO_SHOW);
}

export function formatSlotLabel(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getUTCHours() - 3 + (d.getTimezoneOffset() === 0 ? 0 : 0)).padStart(2, "0");
  // Extract HH:MM from ISO directly (handles +03:00 offset)
  const match = iso.match(/T(\d{2}):(\d{2})/);
  if (!match) return iso;
  return `${match[1]}:${match[2]}`;
}

export function formatDateHe(dateIso: string): string {
  const [year, month, day] = dateIso.split("-");
  return `${day}/${month}/${year}`;
}

export function toIso(dateIso: string, hours: number, minutes: number): string {
  const h = String(hours).padStart(2, "0");
  const m = String(minutes).padStart(2, "0");
  return `${dateIso}T${h}:${m}:00${ISRAEL_TZ_OFFSET}`;
}

function normaliseIso(iso: string): string {
  // Normalise to "YYYY-MM-DDTHH:MM" for comparison (strip seconds/offset)
  return iso.slice(0, 16);
}
