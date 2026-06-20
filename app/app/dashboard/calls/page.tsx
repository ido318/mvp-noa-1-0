"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { Card } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import { CallStatusBadge } from "@/components/dashboard/ui/call-status";
import { PhoneIcon, ClockIcon, SparkleIcon, PlayIcon, XIcon } from "@/components/dashboard/icons";
import { formatIsraelDateTime } from "@/lib/israel-date";
import type { VoiceCall, TranscriptItem } from "@/types/domain/voice-call";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return formatIsraelDateTime(iso);
}

function fmtDuration(secs: number | null) {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")} דק'` : `${s}ש'`;
}

// ─── CallDrawer ────────────────────────────────────────────────────────────────

function TranscriptBubble({ item }: { item: TranscriptItem }) {
  const isAgent = item.role === "agent";
  return (
    <div className={`flex gap-2 ${isAgent ? "flex-row-reverse" : ""}`}>
      <span
        className={[
          "mt-0.5 flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold",
          isAgent
            ? "bg-[var(--coral-100)] text-[var(--coral-700)]"
            : "bg-[var(--surface-2)] text-[var(--ink-2)]",
        ].join(" ")}
      >
        {isAgent ? "ת'" : "👤"}
      </span>
      <div
        className={[
          "max-w-[75%] rounded-[14px] px-3 py-2 text-[13px] leading-relaxed",
          isAgent
            ? "bg-[var(--coral-50)] text-[var(--coral-800)] rounded-se-[4px]"
            : "bg-[var(--surface-2)] text-[var(--ink)] rounded-ss-[4px]",
        ].join(" ")}
      >
        {item.message}
        {item.time_in_call_secs != null && (
          <span className="mt-0.5 block text-[10px] opacity-50">
            {String(Math.floor(item.time_in_call_secs / 60)).padStart(2, "0")}:{String(item.time_in_call_secs % 60).padStart(2, "0")}
          </span>
        )}
      </div>
    </div>
  );
}

function AudioPlayer({ callId }: { callId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  async function load() {
    if (url || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/voice/calls/${callId}/recording`);
      if (!res.ok) throw new Error();
      const d = await res.json() as { data: { url: string } };
      setUrl(d.data.url);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (error) return <p className="text-xs text-[var(--muted)]">הקלטה לא זמינה</p>;

  if (!url) {
    return (
      <button
        className="flex items-center gap-1.5 rounded-full bg-[var(--brand-50)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-700)] transition hover:bg-[var(--brand-100)]"
        onClick={load}
        disabled={loading}
      >
        {loading ? (
          <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : (
          <PlayIcon size={12} />
        )}
        {loading ? "טוען…" : "נגן הקלטה"}
      </button>
    );
  }

  return (
    <audio
      ref={audioRef}
      src={url}
      controls
      className="w-full h-8 rounded-lg"
      style={{ accentColor: "var(--brand-500)" }}
    />
  );
}

function CallDrawer({
  call,
  onClose,
}: {
  call: VoiceCall;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"summary" | "transcript" | "recording">("summary");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed inset-y-0 start-0 z-50 flex w-full max-w-[440px] flex-col bg-[var(--surface)] shadow-[var(--sh-lg)] drawer-enter">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <div>
            <p className="text-[14px] font-bold text-[var(--ink)]">{call.fromNumber}</p>
            <p className="text-xs text-[var(--muted)]">{fmtDate(call.startedAt)}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-[var(--surface-2)]">
            <XIcon size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Meta row */}
          <div className="flex flex-wrap gap-2">
            <CallStatusBadge status={call.status} />
            {call.callCategory && (
              <Badge color={call.callCategory === "operation" ? "brand" : "muted"}>
                {call.callCategory === "operation" ? "פעולה" : "מידע"}
              </Badge>
            )}
            {call.durationSeconds != null && (
              <Badge color="muted">
                <ClockIcon size={10} /> {fmtDuration(call.durationSeconds)}
              </Badge>
            )}
          </div>

          <div className="flex rounded-[var(--r-md)] border border-[var(--line)] overflow-hidden">
            {[
              ["summary", "סיכום"],
              ["transcript", "תמלול"],
              ["recording", "הקלטה"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value as "summary" | "transcript" | "recording")}
                className={[
                  "flex-1 px-3 py-1.5 text-xs font-semibold transition-colors",
                  tab === value
                    ? "bg-[var(--brand-600)] text-white"
                    : "text-[var(--ink-2)] hover:bg-[var(--surface-2)]",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "summary" && (
            call.aiSummary ? (
              <div className="rounded-[var(--r-md)] bg-[var(--brand-50)] p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <SparkleIcon size={13} className="text-[var(--brand-600)]" />
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--brand-700)]">סיכום AI</p>
                </div>
                <p className="text-[13px] text-[var(--ink)] leading-relaxed">{call.aiSummary}</p>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">אין סיכום AI לשיחה הזו.</p>
            )
          )}

          {tab === "recording" && (
            call.recordingStoragePath ? (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">הקלטת השיחה</p>
                <AudioPlayer callId={call.id} />
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">אין הקלטה שמורה לשיחה הזו.</p>
            )
          )}

          {tab === "transcript" && (
            call.transcript && call.transcript.length > 0 ? (
              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">תמלול השיחה</p>
                <div className="space-y-3">
                  {call.transcript.map((item, i) => (
                    <TranscriptBubble key={i} item={item} />
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">אין תמלול שמור לשיחה הזו.</p>
            )
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main table ────────────────────────────────────────────────────────────────

type CategoryFilter = "all" | "operation" | "information";

export default function CallsPage() {
  const [items, setItems] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selected, setSelected] = useState<VoiceCall | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/voice/calls");
      if (res.ok) {
        const d = await res.json() as { data: { items: VoiceCall[] } };
        setItems(d.data.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const filtered = category === "all"
    ? items
    : items.filter(c => c.callCategory === category);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-[var(--ink)]">שיחות</h1>

        {/* Category filter */}
        <div className="flex rounded-[var(--r-md)] border border-[var(--line)] overflow-hidden">
          {(["all", "operation", "information"] as CategoryFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setCategory(f)}
              className={[
                "px-3 py-1.5 text-xs font-semibold transition-colors",
                category === f
                  ? "bg-[var(--brand-600)] text-white"
                  : "text-[var(--ink-2)] hover:bg-[var(--surface-2)]",
              ].join(" ")}
            >
              {f === "all" ? "הכול" : f === "operation" ? "פעולה" : "מידע"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<PhoneIcon size={32} />}
          title="אין שיחות"
          subtitle="שיחות שתומר יקבל יופיעו כאן"
        />
      ) : (
        <Card noPad>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                <th className="px-4 py-3 text-start">מתקשר</th>
                <th className="px-4 py-3 text-start">תאריך ושעה</th>
                <th className="px-4 py-3 text-start">משך</th>
                <th className="px-4 py-3 text-start">סוג</th>
                <th className="px-4 py-3 text-start">סטטוס</th>
                <th className="px-4 py-3 text-start">סיכום</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-2)]">
              {filtered.map((call) => (
                <tr
                  key={call.id}
                  className="cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
                  onClick={() => setSelected(call)}
                >
                  <td className="px-4 py-3 font-medium text-[var(--ink)]">
                    <span className="flex items-center gap-1.5">
                      <PhoneIcon size={13} className="text-[var(--muted)]" />
                      {call.fromNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--ink-2)]">{fmtDate(call.startedAt)}</td>
                  <td className="px-4 py-3 text-[var(--muted)] tabular-nums">{fmtDuration(call.durationSeconds)}</td>
                  <td className="px-4 py-3">
                    {call.callCategory ? (
                      <Badge color={call.callCategory === "operation" ? "brand" : "muted"}>
                        {call.callCategory === "operation" ? "פעולה" : "מידע"}
                      </Badge>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <CallStatusBadge status={call.status} />
                  </td>
                  <td className="px-4 py-3 max-w-[220px]">
                    {call.aiSummary ? (
                      <p className="truncate text-xs text-[var(--ink-2)]">{call.aiSummary}</p>
                    ) : (
                      <span className="text-[var(--faint)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Call drawer */}
      {selected && <CallDrawer call={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
