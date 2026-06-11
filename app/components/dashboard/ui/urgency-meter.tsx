import React from "react";

function urgencyColor(value: number): { bar: string; label: string } {
  if (value >= 8) return { bar: "#DC2626", label: "#B91C1C" };
  if (value >= 6) return { bar: "#F97316", label: "#C2410C" };
  if (value >= 4) return { bar: "#F59E0B", label: "#B45309" };
  return { bar: "#3E9C86", label: "#2F7D5B" };
}

interface UrgencyMeterProps {
  value: number; // 1–10
  showLabel?: boolean;
  className?: string;
}

export function UrgencyMeter({ value, showLabel = true, className = "" }: UrgencyMeterProps) {
  const { bar, label } = urgencyColor(value);
  const clamped = Math.max(0, Math.min(10, value));

  return (
    <div className={["flex items-center gap-2", className].join(" ")}>
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className="block h-[18px] w-1.5 rounded-sm"
            style={{ backgroundColor: i < clamped ? bar : "var(--line)" }}
          />
        ))}
      </div>
      {showLabel && (
        <span className="text-xs font-semibold tabular-nums" style={{ color: label }}>
          {clamped}/10
        </span>
      )}
    </div>
  );
}
