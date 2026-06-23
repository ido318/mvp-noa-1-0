"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/dashboard/ui/card";
import { Btn } from "@/components/dashboard/ui/btn";
import { TypePill } from "@/components/dashboard/ui/type-pill";
import { UrgencyMeter } from "@/components/dashboard/ui/urgency-meter";
import { CallStatusBadge } from "@/components/dashboard/ui/call-status";
import { AnimalAvatar, TomerChip } from "@/components/dashboard/ui/avatar";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import { useToast } from "@/components/dashboard/ui/toast";
import {
  CheckIcon, XIcon, HomeIcon, ClockIcon,
  EscalationIcon, CalendarIcon, CallsIcon, ClientsIcon, SparkleIcon,
} from "@/components/dashboard/icons";
import { ISRAEL_TIMEZONE, formatIsraelDate, formatIsraelTime, israelDateIso } from "@/lib/israel-date";
import type { Appointment } from "@/types/domain/appointment";
import type { Escalation } from "@/types/domain/escalation";
import type { VoiceCall } from "@/types/domain/voice-call";

// ─── helpers ──────────────────────────────────────────────────────────────────

const TZ = ISRAEL_TIMEZONE;

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

function isoToMinutes(iso: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour: "numeric", minute: "numeric", hour12: false,
  }).formatToParts(new Date(iso));
  const h = parseInt(parts.find(p => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(parts.find(p => p.type === "minute")?.value ?? "0", 10);
  return h * 60 + m;
}

function nowMinutes() {
  return isoToMinutes(new Date().toISOString());
}

function nowLabel() {
  return new Intl.DateTimeFormat("he-IL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date());
}

function todayGreeting() {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  const h = parseInt(hour, 10);
  if (h < 12) return "בוקר טוב, ד״ר נועה 🌤️";
  if (h < 17) return "צהריים טובים, ד״ר נועה ☀️";
  return "ערב טוב, ד״ר נועה 🌙";
}

// Appointment type → fg/bg colors
const TYPE_COLORS: Record<string, { fg: string; bg: string }> = {
  checkup:            { fg: "#3E9C86", bg: "#E7F4F0" },
  vaccination:        { fg: "#5B7CFA", bg: "#EEF1FE" },
  vaccine:            { fg: "#5B7CFA", bg: "#EEF1FE" },
  neutering:          { fg: "#E0696D", bg: "#FBEAEB" },
  surgery:            { fg: "#E0696D", bg: "#FBEAEB" },
  home_visit:         { fg: "#D06B33", bg: "#FDF3EB" },
  phone_consultation: { fg: "#5B7CFA", bg: "#EEF1FE" },
  followup:           { fg: "#C2891E", bg: "#FBF2DD" },
  follow_up:          { fg: "#C2891E", bg: "#FBF2DD" },
  grooming:           { fg: "#9B6BD6", bg: "#F3ECFB" },
};

function typeColor(type: string) {
  return TYPE_COLORS[type] ?? { fg: "#867667", bg: "#F2EDE7" };
}

function urgencyColor(value: number) {
  if (value >= 8) return { fg: "#B91C1C", bg: "#FEF2F2", ring: "#F2B8B8" };
  if (value >= 6) return { fg: "#C2410C", bg: "#FFF3EB", ring: "#FAC9A3" };
  if (value >= 4) return { fg: "#B45309", bg: "#FEF8EA", ring: "#F6DDA0" };
  return { fg: "#2F7D5B", bg: "#E9F5EF", ring: "#BBE3D2" };
}

// ─── Timeline constants ────────────────────────────────────────────────────────

const HOUR_PX = 86;
const HOUR_START = 8;
const HOUR_END = 19;
const HOUR_LABELS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => i + HOUR_START);

interface EnrichedAppointment extends Appointment {
  customerName?: string;
  petName?: string;
  petSpecies?: string;
  phone?: string;
}

// ─── ApptCard (timeline) ───────────────────────────────────────────────────────

function ApptCard({
  appt,
  onApprove,
  onReject,
}: {
  appt: EnrichedAppointment;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const startMin = isoToMinutes(appt.scheduledAt);
  const top = (startMin - HOUR_START * 60) * (HOUR_PX / 60);
  const height = Math.max(appt.durationMinutes * (HOUR_PX / 60) - 6, 44);
  const compact = appt.durationMinutes <= 30;
  const isPending = appt.status === "pending_approval";
  const colors = isPending
    ? { fg: "#D99A16", bg: "var(--surface)" }
    : typeColor(appt.appointmentType);
  const isHome = appt.appointmentType === "home_visit";

  return (
    <div
      style={{
        position: "absolute",
        top,
        height,
        right: 0,
        left: 8,
        background: "var(--surface)",
        borderRadius: 13,
        border: "1px solid var(--line)",
        borderInlineStart: `4px solid ${colors.fg}`,
        boxShadow: "var(--sh-sm)",
        padding: compact ? "8px 12px" : "11px 13px",
        cursor: "default",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        gap: 10,
        transition: "box-shadow .2s, transform .15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "var(--sh-md)";
        e.currentTarget.style.transform = "translateX(-3px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "var(--sh-sm)";
        e.currentTarget.style.transform = "none";
      }}
    >
      {/* Time + home icon */}
      <span style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, minWidth: 58 }}>
        <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 800, fontSize: 14, color: "var(--ink)", letterSpacing: "-.02em" }}>
          {formatIsraelTime(appt.scheduledAt)}
        </span>
        {isHome && <HomeIcon size={13} className="text-[var(--brand-600)]" />}
      </span>

      {/* Divider */}
      <span style={{ width: 1, height: compact ? 22 : 30, background: "var(--line-2)", flexShrink: 0 }} />

      {/* Animal avatar */}
      {appt.petSpecies && (
        <AnimalAvatar species={appt.petSpecies} size={compact ? 28 : 34} />
      )}

      {/* Pet + client */}
      <div style={{ flexShrink: 0, minWidth: 0, maxWidth: 188 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
          <span style={{ fontWeight: 700, fontSize: compact ? 13.5 : 14.5, whiteSpace: "nowrap", flexShrink: 0 }}>
            {appt.petName ?? "—"}
          </span>
          <span style={{ fontSize: 12.5, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {appt.customerName ?? ""}
          </span>
        </div>
        {!compact && isPending && (
          <div style={{ fontSize: 11.5, color: "#D99A16", marginTop: 1, fontWeight: 600 }}>ממתין לאישור</div>
        )}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1, minWidth: 0 }} />

      {/* Type pill */}
      <TypePill type={appt.appointmentType} className="flex-shrink-0" />

      {/* Pending approve/reject buttons */}
      {isPending && (
        <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
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

// ─── Timeline ─────────────────────────────────────────────────────────────────

function Timeline({
  appointments,
  onApprove,
  onReject,
}: {
  appointments: EnrichedAppointment[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const nowMin = nowMinutes();
  const nowTop = (nowMin - HOUR_START * 60) * (HOUR_PX / 60);
  const showNow = nowMin >= HOUR_START * 60 && nowMin <= HOUR_END * 60;

  return (
    <Card noPad style={{ overflow: "hidden" }}>
      {/* Card header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 22px",
          borderBottom: "1px solid var(--line-2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 34, height: 34, borderRadius: 10,
              background: "var(--brand-50)", color: "var(--brand-600)",
              display: "grid", placeItems: "center",
            }}
          >
            <CalendarIcon size={18} />
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--ink)" }}>לוח התורים של היום</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
              {appointments.length} תורים מתוכננים · 08:00–19:00
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: 12, fontWeight: 600,
            color: "var(--brand-700)", background: "var(--brand-50)",
            padding: "4px 12px", borderRadius: 99,
          }}
        >
          עכשיו {nowLabel()}
        </span>
      </div>

      {/* Timeline body */}
      <div style={{ padding: "6px 22px 22px", maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>
        <div style={{ position: "relative", marginTop: 8 }}>
          <div style={{ position: "relative", marginInlineStart: 54 }}>
            {/* Hour rows */}
            {HOUR_LABELS.map((h) => (
              <div key={h} style={{ height: HOUR_PX, borderTop: "1px solid var(--line-2)", position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    right: -54,
                    top: -9,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--faint)",
                    fontVariantNumeric: "tabular-nums",
                    width: 44,
                    textAlign: "left",
                  }}
                >
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}

            {/* Now indicator */}
            {showNow && (
              <div
                style={{
                  position: "absolute",
                  top: nowTop,
                  right: 0,
                  left: 0,
                  zIndex: 5,
                  display: "flex",
                  alignItems: "center",
                  pointerEvents: "none",
                }}
              >
                <span
                  style={{
                    width: 9, height: 9, borderRadius: "50%",
                    background: "var(--red-500)",
                    boxShadow: "0 0 0 3px rgba(239,68,68,.18)",
                  }}
                />
                <span style={{ flex: 1, height: 2, background: "var(--red-500)", opacity: .85 }} />
              </div>
            )}

            {/* Appointment cards */}
            {appointments.map((appt) => (
              <ApptCard key={appt.id} appt={appt} onApprove={onApprove} onReject={onReject} />
            ))}

            {appointments.length === 0 && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ fontSize: 13, color: "var(--faint)" }}>אין תורים להיום</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── EscalationsHeroCard ──────────────────────────────────────────────────────

function EscalationsHeroCard({ escalations }: { escalations: Escalation[] }) {
  const open = [...escalations].filter(e => !e.resolvedAt).sort((a, b) => b.urgency - a.urgency);
  const top = open[0];
  const uc = top ? urgencyColor(top.urgency) : null;

  return (
    <Card
      noPad
      style={{
        borderColor: "var(--red-100)",
        boxShadow: "0 6px 22px rgba(220,38,38,.08)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Gradient top bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          left: 0,
          height: 4,
          background: "linear-gradient(90deg,var(--red-500),var(--amber-500))",
        }}
      />

      <div style={{ padding: "24px 18px 18px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: "var(--red-50)", color: "var(--red-600)",
                display: "grid", placeItems: "center",
                animation: open.length > 0 ? "pulseRing 2s ease-in-out infinite" : "none",
              }}
            >
              <EscalationIcon size={20} />
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>אסקלציות פתוחות</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>דורשות את תשומת לבך</div>
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: "var(--red-600)" }}>{open.length}</div>
        </div>

        {/* Most urgent escalation */}
        {top && uc && (
          <div
            style={{
              background: uc.bg,
              borderRadius: 13,
              padding: "13px 14px",
              border: `1px solid ${uc.ring}`,
              marginBottom: 13,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
              <span
                style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 9px",
                  borderRadius: 99, color: "#fff", background: uc.fg,
                }}
              >
                הכי דחוף
              </span>
              <UrgencyMeter value={top.urgency} showLabel={false} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--ink)" }}>{top.reason}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
              <ClockIcon size={11} className="text-[var(--faint)]" />
              <span style={{ fontSize: 12, color: "var(--faint)", fontVariantNumeric: "tabular-nums" }}>
                {formatIsraelTime(top.createdAt)}
              </span>
            </div>
          </div>
        )}

        {open.length === 0 && (
          <div style={{ textAlign: "center", padding: "8px 0 12px", fontSize: 13, color: "var(--muted)" }}>
            אין אסקלציות פתוחות 🐾
          </div>
        )}

        <Link href="/dashboard/escalations" className="block">
          <Btn variant="danger" size="md" className="w-full">
            טפל באסקלציות
          </Btn>
        </Link>
      </div>
    </Card>
  );
}

// ─── CallsTodayCard ────────────────────────────────────────────────────────────

function CallsTodayCard({ calls }: { calls: VoiceCall[] }) {
  const recent = calls.slice(0, 3);

  return (
    <Card noPad>
      <div style={{ padding: 18 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <TomerChip size="md" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>שיחות שתומר ענה היום</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>הסוכן הקולי שלך</div>
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: "var(--brand-700)" }}>{calls.length}</div>
        </div>

        {/* Recent calls */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {recent.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--faint)", textAlign: "center", padding: "8px 0" }}>
              אין שיחות היום עדיין
            </p>
          ) : (
            recent.map((call) => (
              <div
                key={call.id}
                style={{
                  display: "flex", alignItems: "center", gap: 11,
                  padding: "9px 8px", borderRadius: 10, transition: "background .15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--surface-2)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
              >
                <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 12.5, fontWeight: 600, color: "var(--faint)", width: 40, flexShrink: 0 }}>
                  {formatIsraelTime(call.startedAt)}
                </span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: "var(--ink-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {call.fromNumber}
                </span>
                <CallStatusBadge status={call.status} />
              </div>
            ))
          )}
        </div>

        {/* Link to all calls */}
        <Link href="/dashboard/calls">
          <button
            style={{
              marginTop: 12, width: "100%", padding: "10px",
              borderRadius: 10, background: "var(--surface-2)",
              color: "var(--brand-700)", fontWeight: 600, fontSize: 13.5,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              border: "none", cursor: "pointer", transition: "background .15s",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--brand-50)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)"; }}
          >
            לכל השיחות
          </button>
        </Link>
      </div>
    </Card>
  );
}

// ─── StatTile ──────────────────────────────────────────────────────────────────

function StatTile({
  value,
  label,
  Icon,
  tone,
}: {
  value: number | string;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
  tone: "teal" | "amber" | "violet";
}) {
  const tones = {
    teal:   { fg: "var(--brand-700)", bg: "var(--brand-50)" },
    amber:  { fg: "var(--amber-600)", bg: "var(--amber-50)" },
    violet: { fg: "#7C5BD6",          bg: "#F3ECFB" },
  };
  const t = tones[tone];
  return (
    <div
      style={{
        flex: 1,
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "15px 16px",
        boxShadow: "var(--sh-sm)",
        minWidth: 100,
      }}
    >
      <span
        style={{
          width: 32, height: 32, borderRadius: 9,
          background: t.bg, color: t.fg,
          display: "grid", placeItems: "center", marginBottom: 10,
        }}
      >
        <Icon size={17} />
      </span>
      <div style={{ fontSize: 25, fontWeight: 800, lineHeight: 1, color: "var(--ink)" }}>{value}</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

// ─── ApproveRejectModal ────────────────────────────────────────────────────────

function ApproveRejectModal({
  mode, appointmentId, phone, customerName, petName, onConfirm, onClose,
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
          <Btn variant={mode === "approve" ? "primary" : "danger"} size="sm" loading={loading} onClick={handleConfirm}>
            {mode === "approve" ? "אשר תור" : "דחה תור"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

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

  if (loading) {
    return (
      <div className="p-7">
        <div className="mb-6 flex items-end justify-between gap-6 flex-wrap">
          <Skeleton className="h-14 w-56" />
          <div className="flex gap-3">
            <Skeleton className="h-[88px] w-[112px]" />
            <Skeleton className="h-[88px] w-[112px]" />
            <Skeleton className="h-[88px] w-[112px]" />
          </div>
        </div>
        <div className="grid gap-[22px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-[680px]" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-[220px]" />
            <Skeleton className="h-[200px]" />
          </div>
        </div>
      </div>
    );
  }

  const newClients = todayCalls.filter(c => c.status === "completed").length;

  return (
    <div className="page-enter" style={{ padding: "28px 32px 40px" }}>
      {/* ── Header row ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 22,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        {/* Greeting + date */}
        <div>
          <div style={{ fontSize: 13.5, color: "var(--brand-600)", fontWeight: 600, marginBottom: 3 }}>
            {todayGreeting()}
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", color: "var(--ink)" }}>
            היום במרפאה
          </h1>
          <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 4 }}>
            {formatIsraelDate(new Date())}
          </div>
        </div>

        {/* Stat tiles */}
        <div style={{ display: "flex", gap: 10 }}>
          <StatTile value={todayAppts.length} label="תורים היום" Icon={CalendarIcon} tone="teal" />
          <StatTile value={todayCalls.length} label="שיחות" Icon={CallsIcon} tone="amber" />
          <StatTile value={newClients} label="שיחות הושלמו" Icon={ClientsIcon} tone="violet" />
        </div>
      </div>

      {/* ── 2-column grid ──────────────────────────────────────────────────── */}
      <div
        className="grid gap-[22px] xl:grid-cols-[minmax(0,1fr)_360px]"
      >
        {/* Left: Timeline */}
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

        {/* Right: Summary column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <EscalationsHeroCard escalations={escalations} />
          <CallsTodayCard calls={todayCalls} />
        </div>
      </div>

      {/* Approve/Reject modal */}
      {modal && (
        <ApproveRejectModal
          mode={modal.mode}
          appointmentId={modal.appt.id}
          phone={modal.appt.phone ?? ""}
          customerName={modal.appt.customerName ?? ""}
          petName={modal.appt.petName ?? ""}
          onConfirm={() => { setModal(null); void fetchData(); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
