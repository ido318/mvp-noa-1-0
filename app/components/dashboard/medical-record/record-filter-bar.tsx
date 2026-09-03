"use client";
import React from "react";
import type { MedicalRecordTimelineType } from "@/types/api/medical-record-timeline";

const FILTERS: { value: MedicalRecordTimelineType | "all"; label: string }[] = [
  { value: "all", label: "הכל" },
  { value: "visit", label: "ביקורים" },
  { value: "medical_note", label: "הערות" },
  { value: "vital", label: "מדדים" },
  { value: "prescription", label: "מרשמים" },
  { value: "vaccination", label: "חיסונים" },
  { value: "lab_order", label: "מעבדה" },
];

export function RecordFilterBar({
  type,
  query,
  onTypeChange,
  onQueryChange,
}: {
  type: MedicalRecordTimelineType | "all";
  query: string;
  onTypeChange: (type: MedicalRecordTimelineType | "all") => void;
  onQueryChange: (query: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--border-row)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => onTypeChange(filter.value)}
            className={[
              "h-8 rounded-[10px] px-3 text-xs font-semibold transition-colors",
              type === filter.value
                ? "bg-[var(--accent)] text-[var(--text-on-accent)]"
                : "bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:bg-[var(--border-row)]",
            ].join(" ")}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="חיפוש בתיק"
        className="h-9 w-full rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-raised)] px-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--border-focus)] lg:w-56"
      />
    </div>
  );
}
