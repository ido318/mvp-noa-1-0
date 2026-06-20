"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { Btn } from "@/components/dashboard/ui/btn";
import { TypePill } from "@/components/dashboard/ui/type-pill";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import { ChevLeftIcon, ChevRightIcon, CalendarIcon } from "@/components/dashboard/icons";
import { toIsraelLocalIso } from "@/lib/appointment-rules";
import { ISRAEL_TIMEZONE, israelDateIso } from "@/lib/israel-date";
import type { MeResponse } from "@/types/api/me";
import type { Appointment } from "@/types/domain/appointment";
import type { CalendarBlock } from "@/types/domain/calendar-block";

// ─── helpers ──────────────────────────────────────────────────────────────────

const TZ = ISRAEL_TIMEZONE;
const HOUR_START = 8;
const HOUR_END   = 20;
const HOUR_SPAN  = HOUR_END - HOUR_START;

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

function topPct(iso: string) {
  const { h, m } = israelHour(iso);
  return ((h * 60 + m - HOUR_START * 60) / (HOUR_SPAN * 60)) * 100;
}

function heightPct(minutes: number) {
  return (minutes / (HOUR_SPAN * 60)) * 100;
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

function fmtDayHeader(d: Date) {
  return new Intl.DateTimeFormat("he-IL", { timeZone: TZ, day: "numeric", month: "short" }).format(d);
}

// ─── Week columns ──────────────────────────────────────────────────────────────

function ApptBlock({ appt }: { appt: Appointment }) {
  const top  = topPct(appt.scheduledAt);
  const h    = heightPct(appt.durationMinutes);
  const isPending = appt.status === "pending_approval";

  return (
    <div
      className="absolute inset-x-0.5 overflow-hidden rounded-[8px] border px-1.5 py-1 text-[10px]"
      style={{
        top: `${top}%`,
        height: `${Math.max(h, 3)}%`,
        borderColor: isPending ? "var(--amber-300)" : "var(--brand-200)",
        backgroundColor: isPending ? "var(--amber-50)" : "var(--brand-50)",
        color: isPending ? "var(--amber-700)" : "var(--brand-700)",
        minHeight: "28px",
      }}
      title={`${appt.appointmentType} · ${appt.status}`}
    >
      <div className="font-bold leading-tight">
        {String(israelHour(appt.scheduledAt).h).padStart(2, "0")}:{String(israelHour(appt.scheduledAt).m).padStart(2, "0")}
      </div>
      <TypePill type={appt.appointmentType} className="text-[8px] mt-0.5" />
      {isPending && <div className="mt-0.5 text-[8px] font-bold">ממתין ✓</div>}
    </div>
  );
}

function CalendarBlockOverlay({
  block,
  onDelete,
}: {
  block: CalendarBlock;
  onDelete: (blockId: string) => void;
}) {
  const top = topPct(block.startAt);
  const h = heightPct(minutesBetween(block.startAt, block.endAt));

  return (
    <div
      className="absolute inset-x-0.5 overflow-hidden rounded-[8px] border border-[var(--line)] bg-[var(--surface-2)] px-1.5 py-1 text-[10px] text-[var(--muted)]"
      style={{
        top: `${Math.max(0, top)}%`,
        height: `${Math.max(h, 4)}%`,
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
  dayIndex,
  appointments,
  blocks,
  isToday,
  onDeleteBlock,
}: {
  day: Date;
  dayIndex: number;
  appointments: Appointment[];
  blocks: CalendarBlock[];
  isToday: boolean;
  onDeleteBlock: (blockId: string) => void;
}) {
  const isFriday = day.getDay() === 5;
  const isSaturday = day.getDay() === 6;
  const friEnd = ((13 * 60 + 0 - HOUR_START * 60) / (HOUR_SPAN * 60)) * 100;

  if (isSaturday) {
    return (
      <div className="relative flex-1 border-s border-[var(--line-2)] min-w-0">
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg)] opacity-50">
          <span className="text-xs text-[var(--faint)]">סגור</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 border-s border-[var(--line-2)] min-w-0">
      {/* Hour gridlines */}
      {Array.from({ length: HOUR_SPAN + 1 }, (_, i) => i + HOUR_START).map(h => (
        <div
          key={h}
          className="absolute inset-x-0 border-t border-[var(--line-2)]"
          style={{ top: `${((h - HOUR_START) / HOUR_SPAN) * 100}%` }}
        />
      ))}

      {/* Friday closed-after marker */}
      {isFriday && (
        <div
          className="absolute inset-x-0 bottom-0 bg-[var(--bg)] opacity-60"
          style={{ top: `${friEnd}%` }}
        />
      )}

      {/* Appointments */}
      {blocks.map(block => (
        <CalendarBlockOverlay key={block.id} block={block} onDelete={onDeleteBlock} />
      ))}

      {appointments.map(appt => (
        <ApptBlock key={appt.id} appt={appt} />
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

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) as [Date, Date, Date, Date, Date, Date, Date];
  const from = isoOfDate(weekStart);
  const to   = isoOfDate(weekDays[6]);

  const fetchData = useCallback(async (options: { background?: boolean } = {}) => {
    if (!options.background) setLoading(true);
    try {
      const rangeStart = toIsraelLocalIso(from, "00:00");
      const rangeEnd = toIsraelLocalIso(to, "23:59");
      const [apptRes, blockRes, meRes] = await Promise.all([
        fetch(`/api/appointments?from=${encodeURIComponent(rangeStart)}&to=${encodeURIComponent(rangeEnd)}`),
        fetch(`/api/calendar-blocks?from=${encodeURIComponent(rangeStart)}&to=${encodeURIComponent(rangeEnd)}`),
        fetch("/api/me"),
      ]);
      if (apptRes.ok) {
        const d = await apptRes.json() as { data: { items: Appointment[] } };
        setAppointments(d.data.items ?? []);
      }
      if (blockRes.ok) {
        const d = await blockRes.json() as { data: { items: CalendarBlock[] } };
        setBlocks(d.data.items ?? []);
      }
      if (meRes.ok) {
        const d = await meRes.json() as { data: MeResponse };
        setClinicId(d.data.profile.defaultClinicId ?? d.data.memberships[0]?.clinicId ?? null);
      }
    } finally {
      if (!options.background) setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { void fetchData(); }, [fetchData]);

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
    const res = await fetch(`/api/calendar-blocks/${blockId}`, { method: "DELETE" });
    if (res.ok) {
      setBlocks(current => current.filter(block => block.id !== blockId));
    }
  }

  const pendingCount = appointments.filter(a => a.status === "pending_approval").length;
  const HOURS = Array.from({ length: HOUR_SPAN + 1 }, (_, i) => i + HOUR_START);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-extrabold text-[var(--ink)]">יומן</h1>
          {pendingCount > 0 && (
            <Badge color="amber" dot>
              {pendingCount} ממתין{pendingCount > 1 ? "ים" : ""} לאישור
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Btn variant="ghost" size="sm" onClick={() => setWeekStart(weekStartSun(today))}>
            היום
          </Btn>
          <div className="flex items-center rounded-[var(--r-md)] border border-[var(--line)] overflow-hidden">
            <button
              className="px-2.5 py-1.5 text-[var(--ink-2)] hover:bg-[var(--surface-2)] transition-colors"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            >
              <ChevRightIcon size={14} />
            </button>
            <span className="px-3 text-xs font-semibold text-[var(--ink)]">
              {fmtDayHeader(weekStart)} – {fmtDayHeader(weekDays[6])}
            </span>
            <button
              className="px-2.5 py-1.5 text-[var(--ink-2)] hover:bg-[var(--surface-2)] transition-colors"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
            >
              <ChevLeftIcon size={14} />
            </button>
          </div>
        </div>
      </div>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
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

      {loading ? (
        <Skeleton className="h-[560px]" />
      ) : (
        <Card noPad className="overflow-hidden">
          {/* Day headers */}
          <div className="flex border-b border-[var(--line)]">
            <div className="w-12 flex-shrink-0" />
            {weekDays.map((day, i) => {
              const isToday = isoOfDate(day) === today;
              const isSat   = day.getDay() === 6;
              return (
                <div
                  key={i}
                  className={[
                    "flex-1 border-s border-[var(--line-2)] py-2 text-center text-[11px] font-semibold",
                    isToday ? "bg-[var(--brand-50)] text-[var(--brand-700)]" : "text-[var(--ink-2)]",
                    isSat ? "text-[var(--faint)]" : "",
                  ].join(" ")}
                >
                  <div>{HE_DAYS[day.getDay()]}</div>
                  <div className={isToday ? "font-extrabold" : ""}>{fmtDayHeader(day)}</div>
                </div>
              );
            })}
          </div>

          {/* Timeline grid */}
          <div
            className="flex overflow-y-auto"
            style={{ height: "520px" }}
          >
            {/* Hour labels */}
            <div className="relative w-12 flex-shrink-0">
              {HOURS.map(h => (
                <div
                  key={h}
                  className="absolute w-12 text-end pe-2 text-[9px] text-[var(--muted)] leading-none"
                  style={{
                    top: `${((h - HOUR_START) / HOUR_SPAN) * 100}%`,
                    transform: "translateY(-50%)",
                    height: `${100 / HOUR_SPAN}%`,
                  }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            <div className="relative flex flex-1 h-full">
              {weekDays.map((day, i) => (
                <DayColumn
                  key={i}
                  day={day}
                  dayIndex={i}
                  appointments={apptForDay(day)}
                  blocks={blocksForDay(day)}
                  isToday={isoOfDate(day) === today}
                  onDeleteBlock={deleteBlock}
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
  );
}
