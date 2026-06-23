"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { Btn } from "@/components/dashboard/ui/btn";
import { UrgencyMeter } from "@/components/dashboard/ui/urgency-meter";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import { useToast } from "@/components/dashboard/ui/toast";
import { EscalationIcon, ClockIcon, PhoneIcon } from "@/components/dashboard/icons";
import type { Escalation } from "@/types/domain/escalation";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

function ResolveModal({
  escalation,
  onResolved,
  onClose,
}: {
  escalation: Escalation;
  onResolved: () => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleResolve() {
    setLoading(true);
    try {
      const res = await fetch(`/api/escalations/${escalation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      toast("האסקלציה סומנה כטופלה ✓", "success");
      onResolved();
    } catch {
      toast("שגיאה בעדכון האסקלציה", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[var(--r-xl)] bg-[var(--surface)] p-6 shadow-[var(--sh-lg)] modal-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-bold text-[var(--ink)]">סגירת אסקלציה</h3>
        <p className="mt-1 text-sm text-[var(--muted)] truncate">{escalation.reason}</p>

        <div className="mt-4">
          <label className="block text-xs font-semibold text-[var(--ink-2)] mb-1">הערות (אופציונלי)</label>
          <textarea
            className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--faint)] focus:outline-none focus:border-[var(--brand-400)] resize-none"
            rows={3}
            placeholder="מה בוצע? הערות לתיק..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="ghost" size="sm" onClick={onClose}>ביטול</Btn>
          <Btn variant="primary" size="sm" loading={loading} onClick={handleResolve}>
            סמן כטופלה
          </Btn>
        </div>
      </div>
    </div>
  );
}

function urgencyStyle(value: number) {
  if (value >= 8) return { fg: "#B91C1C", bg: "#FEF2F2", ring: "#F2B8B8", border: "#EF4444" };
  if (value >= 6) return { fg: "#C2410C", bg: "#FFF3EB", ring: "#FAC9A3", border: "#F97316" };
  if (value >= 4) return { fg: "#B45309", bg: "#FEF8EA", ring: "#F6DDA0", border: "#F59E0B" };
  return { fg: "#2F7D5B", bg: "#E9F5EF", ring: "#BBE3D2", border: "#3E9C86" };
}

function EscalationCard({
  escalation,
  onResolve,
}: {
  escalation: Escalation;
  onResolve: (e: Escalation) => void;
}) {
  const isResolved = Boolean(escalation.resolvedAt);
  const isCritical = escalation.urgency >= 8 && !isResolved;
  const us = urgencyStyle(escalation.urgency);

  return (
    <div
      className={`relative rounded-[var(--r-lg)] bg-[var(--surface)] shadow-[var(--sh-sm)] transition-opacity overflow-hidden ${isResolved ? "opacity-60" : ""}`}
      style={{
        border: isCritical ? `1px solid ${us.border}` : "1px solid var(--line)",
        boxShadow: isCritical ? `0 6px 22px rgba(220,38,38,.10), var(--sh-sm)` : undefined,
      }}
    >
      {/* Critical left accent bar */}
      {isCritical && (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            insetInlineStart: 0,
            width: 4,
            background: `linear-gradient(180deg, ${us.border}, var(--amber-500))`,
          }}
        />
      )}

      <div className={`p-[18px] ${isCritical ? "ps-[26px]" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          {/* Left: icon + details */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Icon */}
            <span
              className="flex-shrink-0 grid place-items-center rounded-[10px]"
              style={{
                width: 38, height: 38,
                background: us.bg,
                color: us.fg,
                animation: isCritical ? "pulseRing 2s ease-in-out infinite" : "none",
              }}
            >
              <EscalationIcon size={19} />
            </span>

            <div className="flex-1 min-w-0">
              {/* Badges row */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {isCritical && (
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ background: us.fg }}
                  >
                    קריטי
                  </span>
                )}
                <UrgencyMeter value={escalation.urgency} />
                {escalation.afterHours && (
                  <Badge color="amber" dot>אחרי שעות פעילות</Badge>
                )}
                {isResolved && <Badge color="green">טופלה</Badge>}
              </div>

              <p className="text-[14px] font-bold text-[var(--ink)] leading-snug">{escalation.reason}</p>

              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
                <span className="flex items-center gap-1">
                  <ClockIcon size={11} />
                  {formatDate(escalation.createdAt)}
                </span>
                {escalation.elevenLabsConversationId && (
                  <span className="flex items-center gap-1">
                    <PhoneIcon size={11} />
                    שיחה: {escalation.elevenLabsConversationId.slice(-6)}
                  </span>
                )}
              </div>

              {isResolved && escalation.notes && (
                <p className="mt-2 text-xs text-[var(--ink-2)] rounded-[var(--r-sm)] bg-[var(--bg)] px-2 py-1">
                  {escalation.notes}
                </p>
              )}
            </div>
          </div>

          {/* Right: action */}
          {!isResolved && (
            <Btn variant="soft" size="sm" className="flex-shrink-0 mt-1" onClick={() => onResolve(escalation)}>
              טפל
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

type FilterStatus = "open" | "resolved" | "all";

export default function EscalationsPage() {
  const [items, setItems] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("open");
  const [resolveTarget, setResolveTarget] = useState<Escalation | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter === "all" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/escalations${params}`);
      if (res.ok) {
        const d = await res.json() as { data: { items: Escalation[] } };
        setItems(d.data.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const openCount = items.filter(e => !e.resolvedAt).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-extrabold text-[var(--ink)]">אסקלציות</h1>
          {openCount > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--red-500)] text-white text-[11px] font-bold px-1.5">
              {openCount}
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex rounded-[var(--r-md)] border border-[var(--line)] overflow-hidden">
          {(["open", "resolved", "all"] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                "px-3 py-1.5 text-xs font-semibold transition-colors",
                filter === f
                  ? "bg-[var(--brand-600)] text-white"
                  : "text-[var(--ink-2)] hover:bg-[var(--surface-2)]",
              ].join(" ")}
            >
              {f === "open" ? "פתוחות" : f === "resolved" ? "טופלו" : "הכול"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<EscalationIcon size={32} />}
          title={filter === "open" ? "אין אסקלציות פתוחות 🐾" : "אין אסקלציות"}
          subtitle={filter === "open" ? "כשתומר יסמן מקרה כדחוף — הוא יופיע כאן" : ""}
        />
      ) : (
        <div className="space-y-3">
          {items.map((e) => (
            <EscalationCard key={e.id} escalation={e} onResolve={setResolveTarget} />
          ))}
        </div>
      )}

      {/* Resolve modal */}
      {resolveTarget && (
        <ResolveModal
          escalation={resolveTarget}
          onResolved={() => {
            setResolveTarget(null);
            void fetchData();
          }}
          onClose={() => setResolveTarget(null)}
        />
      )}
    </div>
  );
}
