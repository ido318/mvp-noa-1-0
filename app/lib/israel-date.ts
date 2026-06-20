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
