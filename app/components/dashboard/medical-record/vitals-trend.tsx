import React from "react";
import type { MedicalRecordTimelineItem } from "@/types/api/medical-record-timeline";
import type { Vital } from "@/types/domain/vital";

function isVital(data: MedicalRecordTimelineItem["data"]): data is Vital {
  return "recordedAt" in data && "weightKg" in data;
}

export function VitalsTrend({ items }: { items: MedicalRecordTimelineItem[] }) {
  const vitals = items
    .filter((item) => item.type === "vital" && isVital(item.data))
    .map((item) => item.data as Vital)
    .slice(0, 5);

  return (
    <div className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">VitalsTrend</p>
      {vitals.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--faint)]">אין מדדים רשומים עדיין.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {vitals.map((vital) => (
            <div key={vital.id} className="grid grid-cols-3 gap-2 rounded-[var(--r-sm)] bg-[var(--surface-2)] px-2 py-1.5 text-xs">
              <span className="font-semibold text-[var(--ink)]">{vital.weightKg ?? "-"} קג</span>
              <span className="font-semibold text-[var(--ink)]">{vital.temperatureC ?? "-"} C</span>
              <span className="font-semibold text-[var(--ink)]">{vital.heartRateBpm ?? "-"} bpm</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
