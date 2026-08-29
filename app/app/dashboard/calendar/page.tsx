"use client";
import Link from "next/link";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Card } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { Btn } from "@/components/dashboard/ui/btn";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import { AnimalIcon, ChevLeftIcon, ChevRightIcon, CalendarIcon, PlusIcon } from "@/components/dashboard/icons";
import { toIsraelLocalIso, VISIT_TYPE_CONFIG } from "@/lib/appointment-rules";
import { ISRAEL_TIMEZONE, israelDateIso } from "@/lib/israel-date";
import { AppointmentDrawer } from "@/app/dashboard/calendar/appointment-drawer";
import { NewAppointmentWizard } from "@/app/dashboard/calendar/new-appointment-wizard";
import { useSearchParams } from "next/navigation";
import type { MeResponse } from "@/types/api/me";
import type { Appointment } from "@/types/domain/appointment";
import type { CalendarBlock } from "@/types/domain/calendar-block";

// ─── helpers ──────────────────────────────────────────────────────────────────

const TZ = ISRAEL_TIMEZONE;
const HOUR_START = 8;
const HOUR_END   = 20;
const HOUR_SPAN  = HOUR_END - HOUR_START;
const HOUR_HEIGHT_PX = 150;
const TIMELINE_HEIGHT_PX = HOUR_SPAN * HOUR_HEIGHT_PX;

// Days: Sun(0)=א, Mon(1)=ב, Tue(2)=ג, Wed(3)=ד, Thu(4)=ה, Fri(5)=ו
const HE_DAYS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];

function isoOfDate(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

function weekStartSun(iso: string): Date {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function israelHour(iso: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour: "numeric", minute: "numeric", hour12: false,
  }).formatToParts(new Date(iso));
  return {
    h: parseInt(parts.find(p => p.type === "hour")?.value ?? "0", 10),
    m: parseInt(parts.find(p => p.type === "minute")?.value ?? "0", 10),
  };
}

function topPx(iso: string) {
  const { h, m } = israelHour(iso);
  return ((h * 60 + m - HOUR_START * 60) / 60) * HOUR_HEIGHT_PX;
}

function heightPx(minutes: number) {
  return (minutes / 60) * HOUR_HEIGHT_PX;
}

function minutesBetween(startIso: string, endIso: string) {
  return Math.max(10, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000));
}

function calendarBlockErrorMessage(payload: {
  error?: { code?: string; message?: string };
} | null) {
  if (payload?.error?.code === "VALIDATION_ERROR") {
    return "בדקו שהתאריך והשעות תקינים וששעת הסיום אחרי שעת ההתחלה.";
  }
  return payload?.error?.message ?? "שמירת החסימה נכשלה";
}

function apiErrorMessage(
  payload: { error?: { message?: string } } | null,
  fallback: string,
) {
  return payload?.error?.message ?? fallback;
}

function fmtWeekRange(start: Date, end: Date) {
  const startText = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, day: "numeric", month: "long" }).format(start);
  const endText = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }).format(end);
  return `${startText} - ${endText}`;
}

type AppointmentAccent = { bg: string; border: string; text: string; dot: string };

const DEFAULT_ACCENT: AppointmentAccent = { bg: "#F4F6F8", border: "#E2E8ED", text: "#6B7785", dot: "#97A2AD" };

const VISIT_ACCENTS: Record<string, AppointmentAccent> = {
  checkup: { bg: "#E7F4F0", border: "#72B9A7", text: "#237665", dot: "#3E9C86" },
  consultation: { bg: "#E7F4F0", border: "#72B9A7", text: "#237665", dot: "#3E9C86" },
  vaccination: { bg: "#EEF1FE", border: "#8EA0FF", text: "#4A63D9", dot: "#5B7CFA" },
  vaccine: { bg: "#EEF1FE", border: "#8EA0FF", text: "#4A63D9", dot: "#5B7CFA" },
  neutering: { bg: "#FBEAEB", border: "#EF8C90", text: "#B94E52", dot: "#E0696D" },
  urgent: { bg: "#FEF2F2", border: "#F87171", text: "#B91C1C", dot: "#EF4444" },
  home_visit: { bg: "#EEF8F6", border: "#5CC0B6", text: "#0F766E", dot: "#14877D" },
  phone_consultation: { bg: "#EEF1FE", border: "#8EA0FF", text: "#4A63D9", dot: "#5B7CFA" },
  follow_up: { bg: "#FBF2DD", border: "#E4B54D", text: "#9A6A10", dot: "#C2891E" },
  followup: { bg: "#FBF2DD", border: "#E4B54D", text: "#9A6A10", dot: "#C2891E" },
  other: DEFAULT_ACCENT,
};

const CALENDAR_LEGEND: Array<{ label: string; color: string }> = [
  { label: "בדיקה", color: "#0F766E" },
  { label: "חיסון", color: "#5B7CFA" },
  { label: "ניתוח", color: "#E0696D" },
  { label: "מעקב", color: "#C2891E" },
  { label: "טיפול", color: "#14877D" },
];

// A couple of legacy aliases ("vaccine", "followup") can still exist on older rows written
// before the appointment_type enum was tightened to VISIT_TYPE_CONFIG's canonical set —
// same aliases type-pill.tsx already accounts for.
const LEGACY_TYPE_ALIASES: Record<string, keyof typeof VISIT_TYPE_CONFIG> = {
  vaccine: "vaccination",
  followup: "follow_up",
};

function visitLabel(type: string) {
  const canonical = LEGACY_TYPE_ALIASES[type] ?? (type as keyof typeof VISIT_TYPE_CONFIG);
  return VISIT_TYPE_CONFIG[canonical]?.labelHe ?? type;
}

function appointmentAccent(type: string, status: string) {
  if (status === "pending_approval") {
    return { bg: "#FFF4DC", border: "#E7B84D", text: "#9A6A10", dot: "#D99A16" };
  }
  return VISIT_ACCENTS[type] ?? DEFAULT_ACCENT;
}

function appointmentTime(iso: string) {
  const { h, m } = israelHour(iso);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─── Week columns ──────────────────────────────────────────────────────────────

function ApptBlock({ appt, onClick }: { appt: Appointment; onClick: () => void }) {
  const top  = topPx(appt.scheduledAt);
  const h    = heightPx(appt.durationMinutes);
  const accent = appointmentAccent(appt.appointmentType, appt.status);
  const petName = appt.petName ?? "חיה";
  const customerName = appt.customerName ?? "לקוח";
  const title = `${petName} · ${customerName} · ${visitLabel(appt.appointmentType)}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute inset-x-3 z-10 overflow-hidden rounded-[12px] border px-3 py-2.5 text-start text-[12px] shadow-[0_10px_22px_rgba(31,41,51,0.10)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(31,41,51,0.16)]"
      style={{
        top: `${top}px`,
        height: `${Math.max(h, 72)}px`,
        borderColor: accent.border,
        backgroundColor: accent.bg,
        color: accent.text,
        minHeight: "72px",
      }}
      title={title}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-extrabold leading-tight">{petName}</div>
          <div className="mt-0.5 truncate text-[11px] font-semibold opacity-80">{customerName}</div>
        </div>
        <AnimalIcon species={appt.petSpecies ?? "dog"} size={17} className="mt-0.5 flex-shrink-0 opacity-80" />
      </div>
      <div className="mt-2 flex items-center justify-between gap-1 text-[11px] font-bold">
        <span className="truncate">{visitLabel(appt.appointmentType)}</span>
        <span className="shrink-0 opacity-85">{appointmentTime(appt.scheduledAt)}</span>
      </div>
      {appt.status === "pending_approval" && (
        <div className="mt-1 text-[10px] font-extrabold">ממתין לאישור</div>
      )}
    </button>
  );
}

function CalendarBlockOverlay({
  block,
  onDelete,
}: {
  block: CalendarBlock;
  onDelete: (blockId: string) => void;
}) {
  const top = topPx(block.startAt);
  const h = heightPx(minutesBetween(block.startAt, block.endAt));

  return (
    <div
      className="absolute inset-x-2 overflow-hidden rounded-[10px] border border-[#E2E8ED] bg-[#F9FAFB] px-2 py-1.5 text-[10px] text-[var(--muted)] shadow-[inset_3px_0_0_#97A2AD]"
      style={{
        top: `${Math.max(0, top)}px`,
        height: `${Math.max(h, 48)}px`,
        minHeight: "26px",
      }}
      title={block.reason ?? "חסימת יומן"}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-bold text-[var(--ink-2)]">חסום</span>
        <button
          type="button"
          className="rounded px-1 text-[9px] text-[var(--red-700)] hover:bg-[var(--red-50)]"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(block.id);
          }}
        >
          מחק
        </button>
      </div>
      {block.reason && <div className="truncate">{block.reason}</div>}
    </div>
  );
}

function DayColumn({
  day,
  appointments,
  blocks,
  isToday,
  onDeleteBlock,
  onSelectAppointment,
}: {
  day: Date;
  appointments: Appointment[];
  blocks: CalendarBlock[];
  isToday: boolean;
  onDeleteBlock: (blockId: string) => void;
  onSelectAppointment: (appt: Appointment) => void;
}) {
  const isFriday = day.getDay() === 5;
  const isSaturday = day.getDay() === 6;
  const friEnd = ((13 * 60 + 0 - HOUR_START * 60) / 60) * HOUR_HEIGHT_PX;

  if (isSaturday) {
    return (
      <div className="relative min-w-[156px] flex-1 border-s border-[#E2E8ED] bg-[#F9FAFB]">
        <div className="absolute inset-0 flex items-center justify-center opacity-60">
          <span className="text-xs text-[var(--faint)]">סגור</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        "relative min-w-[156px] flex-1 border-s border-[#E2E8ED]",
        isToday ? "bg-white" : "bg-white",
      ].join(" ")}
    >
      {/* Hour gridlines */}
      {Array.from({ length: HOUR_SPAN + 1 }, (_, i) => i + HOUR_START).map(h => (
        <div
          key={h}
          className="absolute inset-x-0 border-t border-[#EEF2F5]"
          style={{ top: `${(h - HOUR_START) * HOUR_HEIGHT_PX}px` }}
        />
      ))}

      {/* Friday closed-after marker */}
      {isFriday && (
        <div
          className="absolute inset-x-0 bottom-0 bg-[var(--bg)] opacity-60"
          style={{ top: `${friEnd}px` }}
        />
      )}

      {/* Appointments */}
      {blocks.map(block => (
        <CalendarBlockOverlay key={block.id} block={block} onDelete={onDeleteBlock} />
      ))}

      {appointments.map(appt => (
        <ApptBlock key={appt.id} appt={appt} onClick={() => onSelectAppointment(appt)} />
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const today = isoOfDate(new Date());
  const [weekStart, setWeekStart] = useState<Date>(() => weekStartSun(today));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingBlock, setSavingBlock] = useState(false);
  const [blockDate, setBlockDate] = useState(today);
  const [blockStart, setBlockStart] = useState("12:00");
  const [blockEnd, setBlockEnd] = useState("20:00");
  const [blockReason, setBlockReason] = useState("סיום מוקדם");
  const [blockError, setBlockError] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const searchParams = useSearchParams();
  const [wizardOpen, setWizardOpen] = useState(() => searchParams.get("newAppointment") === "1");

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) as [Date, Date, Date, Date, Date, Date, Date],
    [weekStart],
  );
  const weekEnd = weekDays[6];
  const from = isoOfDate(weekStart);
  const to   = isoOfDate(weekEnd);

  const fetchData = useCallback(async (options: { background?: boolean } = {}) => {
    if (!options.background) setLoading(true);
    try {
      setCalendarError(null);
      const rangeStart = toIsraelLocalIso(from, "00:00");
      const rangeEnd = toIsraelLocalIso(to, "23:59");

      const meRes = await fetch("/api/me");
      if (!meRes.ok) {
        const payload = await meRes.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(apiErrorMessage(payload, "טעינת פרטי המשתמש נכשלה."));
      }

      const me = await meRes.json() as { data: MeResponse };
      const activeClinicId = me.data.profile.defaultClinicId ?? me.data.memberships[0]?.clinicId ?? null;
      setClinicId(activeClinicId);
      if (!activeClinicId) {
        throw new Error("לא נמצאה מרפאה פעילה למשתמש.");
      }

      const [calendarRes, blockRes] = await Promise.all([
        fetch(`/api/calendar?clinicId=${encodeURIComponent(activeClinicId)}&view=week&date=${encodeURIComponent(from)}`),
        fetch(`/api/calendar-blocks?from=${encodeURIComponent(rangeStart)}&to=${encodeURIComponent(rangeEnd)}`),
      ]);

      if (!calendarRes.ok) {
        const payload = await calendarRes.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(apiErrorMessage(payload, "טעינת התורים ליומן נכשלה."));
      }

      if (!blockRes.ok) {
        const payload = await blockRes.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(apiErrorMessage(payload, "טעינת חסימות היומן נכשלה."));
      }

      const calendarData = await calendarRes.json() as { data: { items: Appointment[] } };
      const blockData = await blockRes.json() as { data: { items: CalendarBlock[] } };
      setAppointments(calendarData.data.items ?? []);
      setBlocks(blockData.data.items ?? []);
    } catch (error) {
      setCalendarError(error instanceof Error ? error.message : "טעינת היומן נכשלה.");
    } finally {
      if (!options.background) setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchData();
    });
  }, [fetchData]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchData({ background: true });
    }, 5000);

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchData({ background: true });
      }
    };

    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [fetchData]);

  function apptForDay(d: Date) {
    const iso = isoOfDate(d);
    return appointments.filter(a => israelDateIso(a.scheduledAt) === iso);
  }

  function blocksForDay(d: Date) {
    const iso = isoOfDate(d);
    return blocks.filter(block => israelDateIso(block.startAt) === iso || israelDateIso(block.endAt) === iso);
  }

  async function createBlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clinicId) {
      setBlockError("לא נמצאה מרפאה פעילה למשתמש.");
      return;
    }

    setSavingBlock(true);
    setBlockError(null);
    try {
      const startAt = toIsraelLocalIso(blockDate, blockStart);
      const endAt = toIsraelLocalIso(blockDate, blockEnd);
      if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
        setBlockError("שעת הסיום חייבת להיות אחרי שעת ההתחלה.");
        return;
      }

      const res = await fetch("/api/calendar-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId,
          startAt,
          endAt,
          reason: blockReason.trim() || null,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null) as {
          error?: { code?: string; message?: string };
        } | null;
        throw new Error(calendarBlockErrorMessage(payload));
      }

      await fetchData();
    } catch (error) {
      setBlockError(error instanceof Error ? error.message : "שמירת החסימה נכשלה");
    } finally {
      setSavingBlock(false);
    }
  }

  async function deleteBlock(blockId: string) {
    setCalendarError(null);
    try {
      const res = await fetch(`/api/calendar-blocks/${blockId}`, { method: "DELETE" });
      if (res.ok) {
        setBlocks(current => current.filter(block => block.id !== blockId));
        return;
      }
      const payload = await res.json().catch(() => null) as { error?: { message?: string } } | null;
      setCalendarError(apiErrorMessage(payload, "מחיקת החסימה נכשלה."));
    } catch {
      setCalendarError("מחיקת החסימה נכשלה.");
    }
  }

  const pendingCount = appointments.filter(a => a.status === "pending_approval").length;
  const HOURS = Array.from({ length: HOUR_SPAN + 1 }, (_, i) => i + HOUR_START);
  const weekRange = fmtWeekRange(weekStart, weekEnd);

  return (
    <div className="min-h-full bg-[#F4F6F8] p-6">
      <div className="mx-auto max-w-[1280px] space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold leading-tight text-[var(--ink)]">יומן</h1>
          <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
            {weekRange} · בחרו תור כדי לשנות מועד
          </p>
          {pendingCount > 0 && (
            <Badge color="amber" dot className="mt-2">
              {pendingCount} ממתין{pendingCount > 1 ? "ים" : ""} לאישור
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] bg-[var(--brand-600)] px-4 text-sm font-semibold text-white shadow-[var(--sh-sm)] transition-all hover:brightness-110 active:brightness-95"
          >
            <PlusIcon size={15} />
            תור חדש
          </button>
          <div className="flex h-10 items-center overflow-hidden rounded-[12px] border border-[#E2E8ED] bg-white shadow-[var(--sh-sm)]">
            <button
              type="button"
              className="flex h-full w-11 items-center justify-center text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-2)]"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            >
              <ChevRightIcon size={14} />
            </button>
            <span className="min-w-[112px] border-x border-[#E2E8ED] px-4 text-center text-sm font-extrabold text-[var(--ink)]">
              השבוע
            </span>
            <button
              type="button"
              className="flex h-full w-11 items-center justify-center text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-2)]"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
            >
              <ChevLeftIcon size={14} />
            </button>
          </div>
          <Btn variant="soft" size="md" className="h-10 rounded-[12px]" onClick={() => setWeekStart(weekStartSun(today))}>
            היום
          </Btn>
        </div>
      </div>

      <Card className="space-y-3 border-[#E2E8ED] bg-white/82 shadow-[0_14px_34px_rgba(31,41,51,0.07)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[var(--ink)]">חסימת יומן</h2>
            <p className="text-xs text-[var(--muted)]">חסום שעות שבהן נועה לא זמינה. תומר לא יציע תורים בטווחים האלה.</p>
          </div>
          <Badge color="muted">{blocks.length} חסימות השבוע</Badge>
        </div>

        <form className="grid gap-2 md:grid-cols-[1fr_120px_120px_1.4fr_auto]" onSubmit={createBlock}>
          <input
            type="date"
            value={blockDate}
            onChange={(event) => setBlockDate(event.target.value)}
            className="h-9 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-400)]"
            required
          />
          <input
            type="time"
            value={blockStart}
            onChange={(event) => setBlockStart(event.target.value)}
            className="h-9 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-400)]"
            required
          />
          <input
            type="time"
            value={blockEnd}
            onChange={(event) => setBlockEnd(event.target.value)}
            className="h-9 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-400)]"
            required
          />
          <input
            type="text"
            value={blockReason}
            onChange={(event) => setBlockReason(event.target.value)}
            placeholder="סיבה"
            className="h-9 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)] focus:border-[var(--brand-400)]"
          />
          <Btn type="submit" size="sm" loading={savingBlock}>חסום</Btn>
        </form>

        {blockError && <p className="text-xs font-semibold text-[var(--red-700)]">{blockError}</p>}
      </Card>

      {calendarError && (
        <div className="rounded-[var(--r-md)] border border-[var(--red-100)] bg-[var(--red-50)] px-3 py-2 text-sm font-semibold text-[var(--red-700)]">
          {calendarError}
        </div>
      )}

      {loading ? (
        <Skeleton className="h-[560px]" />
      ) : (
        <Card noPad className="overflow-hidden rounded-[18px] border-[#E2E8ED] bg-white shadow-[0_18px_50px_rgba(31,41,51,0.10)]">
          <div className="flex items-center justify-between gap-3 border-b border-[#E2E8ED] bg-white px-6 py-4">
            <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold text-[var(--muted)]">
              {CALENDAR_LEGEND.map(({ label, color }) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  {label}
                </span>
              ))}
            </div>
            <span className="text-xs font-semibold text-[var(--muted)]">
              {appointments.length} תורים השבוע
            </span>
          </div>

          <div className="flex border-b border-[#E2E8ED] bg-white">
            <div className="w-16 flex-shrink-0" />
            {weekDays.map((day, i) => {
              const isToday = isoOfDate(day) === today;
              const isSat   = day.getDay() === 6;
              return (
                <div
                  key={i}
                  className={[
                    "min-w-[156px] flex-1 border-s border-[#EEF2F5] py-3 text-center",
                    isToday ? "bg-[#EEF8F6] text-[var(--brand-700)]" : "text-[var(--ink-2)]",
                    isSat ? "text-[var(--faint)]" : "",
                  ].join(" ")}
                >
                  <div className="text-[12px] font-bold">{HE_DAYS[day.getDay()]}</div>
                  <div className="mt-0.5 text-[22px] font-extrabold leading-none">{new Intl.DateTimeFormat("he-IL", { timeZone: TZ, day: "2-digit" }).format(day)}</div>
                </div>
              );
            })}
          </div>

          <div
            className="flex overflow-auto bg-white"
            style={{ height: `${TIMELINE_HEIGHT_PX}px` }}
          >
            <div className="relative w-16 flex-shrink-0 bg-white">
              {HOURS.map(h => (
                <div
                  key={h}
                  className="absolute w-16 pe-3 text-end text-[11px] font-semibold leading-none text-[var(--muted)]"
                  style={{
                    top: `${(h - HOUR_START) * HOUR_HEIGHT_PX}px`,
                    transform: "translateY(-50%)",
                    height: `${HOUR_HEIGHT_PX}px`,
                  }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            <div className="relative flex h-full flex-1">
              {weekDays.map((day, i) => (
                <DayColumn
                  key={i}
                  day={day}
                  appointments={apptForDay(day)}
                  blocks={blocksForDay(day)}
                  isToday={isoOfDate(day) === today}
                  onDeleteBlock={deleteBlock}
                  onSelectAppointment={setSelectedAppointment}
                />
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Empty state (no appointments at all) */}
      {!loading && appointments.length === 0 && (
        <EmptyState
          icon={<CalendarIcon size={32} />}
          title="אין תורים השבוע"
          subtitle="כשיקבעו תורים — הם יופיעו כאן"
        />
      )}
      </div>

      <AppointmentDrawer
        appointment={selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        onChanged={() => void fetchData()}
      />

      <NewAppointmentWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        clinicId={clinicId ?? ""}
        onCreated={() => void fetchData()}
        initialCustomerId={searchParams.get("customerId")}
        initialPetId={searchParams.get("petId")}
      />
    </div>
  );
}
