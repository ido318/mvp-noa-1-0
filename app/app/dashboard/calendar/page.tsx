"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { Btn } from "@/components/dashboard/ui/btn";
import { TypePill } from "@/components/dashboard/ui/type-pill";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import { ChevLeftIcon, ChevRightIcon, CalendarIcon } from "@/components/dashboard/icons";
import type { Appointment } from "@/types/domain/appointment";

// ─── helpers ──────────────────────────────────────────────────────────────────

const TZ = "Asia/Jerusalem";
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

function DayColumn({
  day,
  dayIndex,
  appointments,
  isToday,
}: {
  day: Date;
  dayIndex: number;
  appointments: Appointment[];
  isToday: boolean;
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
  const [loading, setLoading] = useState(true);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) as [Date, Date, Date, Date, Date, Date, Date];
  const from = isoOfDate(weekStart);
  const to   = isoOfDate(weekDays[6]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/appointments?from=${from}&to=${to}`);
      if (res.ok) {
        const d = await res.json() as { data: { items: Appointment[] } };
        setAppointments(d.data.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  function apptForDay(d: Date) {
    const iso = isoOfDate(d);
    return appointments.filter(a => a.scheduledAt.startsWith(iso));
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
                  isToday={isoOfDate(day) === today}
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
