"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { Btn } from "@/components/dashboard/ui/btn";
import { TypePill } from "@/components/dashboard/ui/type-pill";
import { UrgencyMeter } from "@/components/dashboard/ui/urgency-meter";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import { useToast } from "@/components/dashboard/ui/toast";
import { PhoneIcon, ClockIcon, SparkleIcon, CheckIcon, XIcon, UserIcon } from "@/components/dashboard/icons";
import { ISRAEL_TIMEZONE, formatIsraelDate, formatIsraelTime, israelDateIso } from "@/lib/israel-date";
import type { Appointment } from "@/types/domain/appointment";
import type { Escalation } from "@/types/domain/escalation";
import type { VoiceCall } from "@/types/domain/voice-call";

// ─── helpers ──────────────────────────────────────────────────────────────────

const TZ = ISRAEL_TIMEZONE;

function israelTime(iso: string) {
  return formatIsraelTime(iso);
}

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

function isoToMinutes(iso: string) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "numeric", hour12: false }).formatToParts(d);
  const h = parseInt(parts.find(p => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(parts.find(p => p.type === "minute")?.value ?? "0", 10);
  return h * 60 + m;
}

const TIMELINE_START = 8 * 60;   // 08:00
const TIMELINE_END   = 20 * 60;  // 20:00
const TIMELINE_SPAN  = TIMELINE_END - TIMELINE_START;
const HOUR_LABELS = Array.from({ length: 13 }, (_, i) => i + 8); // 8..20

// ─── Timeline ─────────────────────────────────────────────────────────────────

function TimelineAppointment({
  appt,
  onApprove,
  onReject,
}: {
  appt: Appointment & { customerName?: string; petName?: string; phone?: string };
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  const startMin  = isoToMinutes(appt.scheduledAt);
  const topPct    = ((startMin - TIMELINE_START) / TIMELINE_SPAN) * 100;
  const heightPct = (appt.durationMinutes / TIMELINE_SPAN) * 100;
  const isPending = appt.status === "pending_approval";

  return (
    <div
      className="absolute inset-x-2 overflow-hidden rounded-[10px] border px-2.5 py-1.5 text-[11px] font-medium transition-shadow hover:shadow-md"
      style={{
        top: `${topPct}%`,
        height: `${heightPct}%`,
        borderColor: isPending ? "var(--amber-300)" : "var(--brand-200)",
        backgroundColor: isPending ? "var(--amber-50)" : "var(--brand-50)",
        color: isPending ? "var(--amber-700)" : "var(--brand-700)",
        minHeight: "36px",
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="font-bold leading-tight">{israelTime(appt.scheduledAt)}</span>
        {isPending && (
          <span className="flex-shrink-0 rounded-full bg-[var(--amber-100)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--amber-700)]">
            ממתין לאישור
          </span>
        )}
      </div>
      {appt.petName && <div className="truncate leading-tight">{appt.petName}</div>}
      <TypePill type={appt.appointmentType} className="mt-0.5 text-[9px]" />

      {isPending && onApprove && onReject && (
        <div className="mt-1 flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            className="flex h-5 items-center gap-0.5 rounded-full bg-[#E9F5EF] px-1.5 text-[9px] font-bold text-[#2F7D5B] transition hover:brightness-90"
            onClick={() => onApprove(appt.id)}
          >
            <CheckIcon size={9} /> אשר
          </button>
          <button
            className="flex h-5 items-center gap-0.5 rounded-full bg-[var(--red-50)] px-1.5 text-[9px] font-bold text-[var(--red-700)] transition hover:brightness-90"
            onClick={() => onReject(appt.id)}
          >
            <XIcon size={9} /> דחה
          </button>
        </div>
      )}
    </div>
  );
}

function Timeline({ appointments, onApprove, onReject }: {
  appointments: (Appointment & { customerName?: string; petName?: string; phone?: string })[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowPct = ((nowMin - TIMELINE_START) / TIMELINE_SPAN) * 100;
  const showNow = nowMin >= TIMELINE_START && nowMin <= TIMELINE_END;

  return (
    <div className="relative flex" style={{ height: `${TIMELINE_SPAN * 2.5}px` }}>
      {/* Hour labels */}
      <div className="w-12 flex-shrink-0 select-none">
        {HOUR_LABELS.map((h) => {
          const pct = ((h * 60 - TIMELINE_START) / TIMELINE_SPAN) * 100;
          return (
            <div
              key={h}
              className="absolute end-0 w-12 text-end text-[10px] text-[var(--muted)] leading-none"
              style={{ top: `${pct}%`, transform: "translateY(-50%)" }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          );
        })}
      </div>

      {/* Grid + appointments */}
      <div className="relative flex-1 border-s border-[var(--line)]">
        {/* Hour lines */}
        {HOUR_LABELS.map((h) => {
          const pct = ((h * 60 - TIMELINE_START) / TIMELINE_SPAN) * 100;
          return (
            <div
              key={h}
              className="absolute inset-x-0 border-t border-[var(--line-2)]"
              style={{ top: `${pct}%` }}
            />
          );
        })}

        {/* Now line */}
        {showNow && (
          <div
            className="absolute inset-x-0 z-10 border-t-2 border-[var(--brand-500)]"
            style={{ top: `${nowPct}%` }}
          >
            <div className="h-2.5 w-2.5 -mt-[5px] -ms-[5px] rounded-full bg-[var(--brand-500)]" />
          </div>
        )}

        {/* Appointments */}
        {appointments.map((appt) => (
          <TimelineAppointment
            key={appt.id}
            appt={appt}
            onApprove={onApprove}
            onReject={onReject}
          />
        ))}

        {appointments.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-[var(--faint)]">אין תורים להיום</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ApproveModal ──────────────────────────────────────────────────────────────

function ApproveRejectModal({
  mode,
  appointmentId,
  phone,
  customerName,
  petName,
  onConfirm,
  onClose,
}: {
  mode: "approve" | "reject";
  appointmentId: string;
  phone: string;
  customerName: string;
  petName: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleConfirm() {
    setLoading(true);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, customerName, petName }),
      });
      if (!res.ok) throw new Error();
      toast(mode === "approve" ? "התור אושר ונשלח SMS ללקוח ✓" : "התור נדחה ונשלח SMS ללקוח ✓", "success");
      onConfirm();
    } catch {
      toast("שגיאה בעדכון התור", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-[var(--r-xl)] bg-[var(--surface)] p-6 shadow-[var(--sh-lg)] modal-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-bold text-[var(--ink)]">
          {mode === "approve" ? "אישור תור עיקור/סירוס" : "דחיית תור עיקור/סירוס"}
        </h3>
        <p className="mt-2 text-sm text-[var(--ink-2)]">
          {mode === "approve"
            ? `האם לאשר את תורו של ${petName}? לאחר האישור ישלח SMS ל-${customerName}.`
            : `האם לדחות את תורו של ${petName}? לאחר הדחייה ישלח SMS ביטול ל-${customerName}.`}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="ghost" size="sm" onClick={onClose}>ביטול</Btn>
          <Btn
            variant={mode === "approve" ? "primary" : "danger"}
            size="sm"
            loading={loading}
            onClick={handleConfirm}
          >
            {mode === "approve" ? "אשר תור" : "דחה תור"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Stat tile ─────────────────────────────────────────────────────────────────

function StatTile({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <Card className={accent ?? ""}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums text-[var(--ink)]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--ink-2)]">{sub}</p>}
    </Card>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface EnrichedAppointment extends Appointment {
  customerName?: string;
  petName?: string;
  phone?: string;
}

export default function TodayPage() {
  const [appointments, setAppointments] = useState<EnrichedAppointment[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [todayCalls, setTodayCalls] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: "approve" | "reject"; appt: EnrichedAppointment } | null>(null);

  const today = todayIso();

  const fetchData = useCallback(async () => {
    try {
      const [apptRes, escRes, callRes] = await Promise.all([
        fetch(`/api/appointments?date=${today}`),
        fetch("/api/escalations?status=open"),
        fetch(`/api/voice/calls?from=${today}&to=${today}`),
      ]);

      if (apptRes.ok) {
        const d = await apptRes.json() as { data: { items: EnrichedAppointment[] } };
        setAppointments((d.data.items ?? []).sort((a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
        ));
      }
      if (escRes.ok) {
        const d = await escRes.json() as { data: { items: Escalation[] } };
        setEscalations(d.data.items ?? []);
      }
      if (callRes.ok) {
        const d = await callRes.json() as { data: { items: VoiceCall[] } };
        setTodayCalls(d.data.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const todayAppts = appointments.filter(a => israelDateIso(a.scheduledAt) === today);
  const pending = appointments.filter(a => a.status === "pending_approval");
  const completedCalls = todayCalls.filter(c => c.status === "completed").length;

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--ink)]">היום</h1>
          <p className="text-sm text-[var(--muted)]">
            {formatIsraelDate(new Date())}
          </p>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-4">
        <StatTile label="תורים היום" value={todayAppts.length} sub={`${todayAppts.filter(a => a.status === "completed").length} הושלמו`} />
        <StatTile label="שיחות היום" value={completedCalls} sub="שיחות שהסתיימו" />
        <StatTile label="אסקלציות פתוחות" value={escalations.length}
          accent={escalations.length > 0 ? "border-[var(--red-200)] bg-[var(--red-50)]" : ""}
        />
      </div>

      {/* Pending approval banner */}
      {pending.length > 0 && (
        <div className="rounded-[var(--r-lg)] border border-[var(--amber-300)] bg-[var(--amber-50)] p-4">
          <div className="flex items-start gap-3">
            <SparkleIcon size={18} className="mt-0.5 flex-shrink-0 text-[var(--amber-600)]" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[var(--amber-700)]">
                {pending.length} תור{pending.length > 1 ? "ים" : ""} ממתין{pending.length > 1 ? "ים" : ""} לאישורך
              </p>
              <p className="text-xs text-[var(--amber-600)]">תורי עיקור/סירוס שנקבעו ע&quot;י תומר מחכים לאישור ידני</p>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {pending.map((appt) => (
              <div key={appt.id} className="flex items-center justify-between rounded-[var(--r-md)] bg-white/70 px-3 py-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-[var(--ink)]">{israelTime(appt.scheduledAt)}</span>
                  <TypePill type={appt.appointmentType} />
                  {appt.petName && <span className="text-[var(--ink-2)]">{appt.petName}</span>}
                  {appt.customerName && <span className="text-[var(--muted)]">— {appt.customerName}</span>}
                </div>
                <div className="flex gap-1.5">
                  <Btn
                    variant="soft"
                    size="sm"
                    onClick={() => setModal({ mode: "approve", appt })}
                  >
                    <CheckIcon size={12} /> אשר
                  </Btn>
                  <Btn
                    variant="dangerSoft"
                    size="sm"
                    onClick={() => setModal({ mode: "reject", appt })}
                  >
                    <XIcon size={12} /> דחה
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open escalations */}
      {escalations.length > 0 && (
        <Card noPad>
          <div className="flex items-center justify-between px-[18px] pt-[18px] pb-3">
            <p className="text-[13px] font-bold text-[var(--red-700)]">אסקלציות פתוחות</p>
            <a href="/dashboard/escalations" className="text-xs text-[var(--brand-600)] hover:underline">הצג הכול</a>
          </div>
          <div className="divide-y divide-[var(--line-2)]">
            {escalations.slice(0, 3).map((esc) => (
              <div key={esc.id} className="flex items-center gap-3 px-[18px] py-3">
                <UrgencyMeter value={esc.urgency} showLabel={false} className="w-16" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[var(--ink)]">{esc.reason}</p>
                  <p className="text-xs text-[var(--muted)]">{formatIsraelTime(esc.createdAt)}</p>
                </div>
                {esc.afterHours && (
                  <Badge color="amber">אחרי שעות</Badge>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Today's calls */}
      {todayCalls.length > 0 && (
        <Card noPad>
          <div className="flex items-center justify-between px-[18px] pt-[18px] pb-3">
            <p className="text-[13px] font-bold text-[var(--ink)]">שיחות היום</p>
            <a href="/dashboard/calls" className="text-xs text-[var(--brand-600)] hover:underline">הצג הכול</a>
          </div>
          <div className="divide-y divide-[var(--line-2)]">
            {todayCalls.slice(0, 4).map((call) => (
              <div key={call.id} className="flex items-center gap-3 px-[18px] py-2.5">
                <PhoneIcon size={14} className="flex-shrink-0 text-[var(--muted)]" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[13px] text-[var(--ink)]">{call.fromNumber}</p>
                  {call.aiSummary && (
                    <p className="truncate text-xs text-[var(--muted)]">{call.aiSummary.slice(0, 80)}</p>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-1.5 text-[11px] text-[var(--muted)]">
                  <ClockIcon size={11} />
                  {israelTime(call.startedAt)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Timeline */}
      <Card noPad>
        <div className="px-[18px] pt-[18px] pb-3">
          <p className="text-[13px] font-bold text-[var(--ink)]">ציר זמן יומי</p>
          <p className="text-xs text-[var(--muted)]">08:00 – 20:00</p>
        </div>
        <div className="overflow-y-auto px-4 pb-6" style={{ maxHeight: "480px" }}>
          <Timeline
            appointments={todayAppts}
            onApprove={(id) => {
              const appt = appointments.find(a => a.id === id);
              if (appt) setModal({ mode: "approve", appt });
            }}
            onReject={(id) => {
              const appt = appointments.find(a => a.id === id);
              if (appt) setModal({ mode: "reject", appt });
            }}
          />
        </div>
      </Card>

      {/* Empty state */}
      {todayAppts.length === 0 && escalations.length === 0 && todayCalls.length === 0 && (
        <EmptyState
          icon={<UserIcon size={32} />}
          title="אין פעילות להיום"
          subtitle="כשיהיו תורים, אסקלציות או שיחות — הן יופיעו כאן"
        />
      )}

      {/* Approve/Reject modal */}
      {modal && (
        <ApproveRejectModal
          mode={modal.mode}
          appointmentId={modal.appt.id}
          phone={modal.appt.phone ?? ""}
          customerName={modal.appt.customerName ?? ""}
          petName={modal.appt.petName ?? ""}
          onConfirm={() => {
            setModal(null);
            void fetchData();
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
