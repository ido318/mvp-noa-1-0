"use client";
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/dashboard/ui/badge";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { formatIsraelDateTime } from "@/lib/israel-date";
import { RecordFilterBar } from "@/components/dashboard/medical-record/record-filter-bar";
import type {
  MedicalRecordTimelineItem,
  MedicalRecordTimelineType,
} from "@/types/api/medical-record-timeline";

const TYPE_LABELS: Record<MedicalRecordTimelineType, string> = {
  visit: "ביקור",
  medical_note: "הערה",
  vital: "מדדים",
  prescription: "מרשם",
  vaccination: "חיסון",
  lab_order: "מעבדה",
};

const TYPE_COLORS: Record<MedicalRecordTimelineType, "brand" | "coral" | "amber" | "red" | "green" | "muted"> = {
  visit: "brand",
  medical_note: "muted",
  vital: "coral",
  prescription: "green",
  vaccination: "amber",
  lab_order: "red",
};

export function MedicalTimeline({ items }: { items: MedicalRecordTimelineItem[] }) {
  const [type, setType] = useState<MedicalRecordTimelineType | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      const typeMatches = type === "all" || item.type === type;
      const queryMatches = !normalized || `${item.title} ${item.subtitle ?? ""}`.toLowerCase().includes(normalized);
      return typeMatches && queryMatches;
    });
  }, [items, query, type]);

  return (
    <div className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)]">
      <RecordFilterBar type={type} query={query} onTypeChange={setType} onQueryChange={setQuery} />
      {filtered.length === 0 ? (
        <EmptyState title="אין רשומות מתאימות" subtitle="נסה לסנן אחרת או לנקות את החיפוש" className="py-10" />
      ) : (
        <ol className="divide-y divide-[var(--line-2)]">
          {filtered.map((item) => (
            <li key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color={TYPE_COLORS[item.type]}>{TYPE_LABELS[item.type]}</Badge>
                    <p className="text-[13px] font-semibold text-[var(--muted)]">{formatIsraelDateTime(item.occurredAt)}</p>
                  </div>
                  <Link href={item.sourceHref} className="mt-2 block text-sm font-bold text-[var(--ink)] hover:text-[var(--brand-700)]">
                    {item.title}
                  </Link>
                  {item.subtitle && (
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--ink-2)]">{item.subtitle}</p>
                  )}
                </div>
                {item.sourceVisitId && (
                  <Link href={`/dashboard/visits/${item.sourceVisitId}`} className="flex-shrink-0 text-xs font-semibold text-[var(--brand-600)] hover:underline">
                    מקור
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
