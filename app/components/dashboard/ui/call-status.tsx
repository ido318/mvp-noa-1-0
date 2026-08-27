import React from "react";

export type CallStatus = "done" | "missed" | "escalated" | "active" | "completed" | "failed" | "in_progress";

const STATUS_MAP: Record<CallStatus, { label: string; fg: string; bg: string; pulse?: boolean }> = {
  done:        { label: "הושלמה",   fg: "#2F7D5B", bg: "#E9F5EF" },
  completed:   { label: "הושלמה",   fg: "#2F7D5B", bg: "#E9F5EF" },
  missed:      { label: "נכשלה",    fg: "#6B7785", bg: "#EEF2F5" },
  failed:      { label: "נכשלה",    fg: "#6B7785", bg: "#EEF2F5" },
  escalated:   { label: "הוסלמה",   fg: "#B91C1C", bg: "#FEF2F2" },
  active:      { label: "בתהליך",   fg: "#D97706", bg: "#FEF6E9", pulse: true },
  in_progress: { label: "בתהליך",   fg: "#D97706", bg: "#FEF6E9", pulse: true },
};

interface CallStatusBadgeProps {
  status: string;
  className?: string;
}

export function CallStatusBadge({ status, className = "" }: CallStatusBadgeProps) {
  const s = STATUS_MAP[status as CallStatus] ?? STATUS_MAP.missed;
  return (
    <span
      className={["inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold", className].join(" ")}
      style={{ color: s.fg, backgroundColor: s.bg }}
    >
      <span
        className={["w-1.5 h-1.5 rounded-full flex-shrink-0", s.pulse ? "animate-[pulseRing_2s_ease-in-out_infinite]" : ""].join(" ")}
        style={{ backgroundColor: s.fg }}
      />
      {s.label}
    </span>
  );
}
