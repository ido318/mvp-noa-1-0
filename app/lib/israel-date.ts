export const ISRAEL_TIMEZONE = "Asia/Jerusalem";

export function israelDateIso(iso: string | Date): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ISRAEL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function israelDayUtcRange(dateIso: string): { from: string; to: string } {
  const [year, month, day] = dateIso.split("-").map(Number);
  if (!year || !month || !day) throw new Error(`Invalid Israel date: ${dateIso}`);

  const start = localIsraelDateTimeToUtc(year, month, day);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const end = localIsraelDateTimeToUtc(
    nextDay.getUTCFullYear(),
    nextDay.getUTCMonth() + 1,
    nextDay.getUTCDate(),
  );

  return { from: start.toISOString(), to: end.toISOString() };
}

export function formatIsraelTime(iso: string | Date): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: ISRAEL_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatIsraelDate(iso: string | Date): string {
  const dateIso = israelDateIso(iso);
  const [year, month, day] = dateIso.split("-");
  if (!year || !month || !day) return dateIso;
  return `${day}/${month}/${year.slice(-2)}`;
}

export function formatIsraelDateTime(iso: string | Date): string {
  return `${formatIsraelDate(iso)} ${formatIsraelTime(iso)}`;
}

function localIsraelDateTimeToUtc(year: number, month: number, day: number): Date {
  const localAsUtc = new Date(Date.UTC(year, month - 1, day));
  const offset = israelOffsetMinutes(localAsUtc);
  const utc = new Date(localAsUtc.getTime() - offset * 60_000);
  const correctedOffset = israelOffsetMinutes(utc);

  return correctedOffset === offset
    ? utc
    : new Date(localAsUtc.getTime() - correctedOffset * 60_000);
}

function israelOffsetMinutes(date: Date): number {
  const offsetName = new Intl.DateTimeFormat("en-US", {
    timeZone: ISRAEL_TIMEZONE,
    timeZoneName: "shortOffset",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

  const match = offsetName?.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) throw new Error(`Could not determine Israel timezone offset: ${offsetName ?? "missing"}`);

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");

  return sign * (hours * 60 + minutes);
}
