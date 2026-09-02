"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { SkeletonRow } from "@/components/dashboard/ui/skeleton";
import type { CallReview, CallReviewSeverityFilter } from "@/types/domain/call-review";

const SEVERITY_TONE: Record<string, "critical" | "pending" | "info" | "done"> = {
  critical: "critical",
  high: "critical",
  medium: "pending",
  low: "info",
  none: "done",
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "קריטית",
  high: "גבוהה",
  medium: "בינונית",
  low: "נמוכה",
  none: "ללא חריגה",
};

const FILTERS: { value: CallReviewSeverityFilter; label: string }[] = [
  { value: "all", label: "הכול" },
  { value: "critical", label: "קריטית" },
  { value: "medium", label: "בינונית" },
  { value: "none", label: "ללא חריגה" },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function ProviderAdminCallsPage() {
  const [items, setItems] = useState<CallReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState<CallReviewSeverityFilter>("all");

  const fetchData = useCallback(async (sev: CallReviewSeverityFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/provider-admin/calls?severity=${sev}&page=1`);
      if (res.ok) {
        const d = (await res.json()) as { data: { items: CallReview[] } };
        setItems(d.data.items ?? []);
      } else {
        setError("שגיאה בטעינת השיחות. נסה לרענן את הדף.");
      }
    } catch {
      setError("שגיאה בטעינת השיחות. נסה לרענן את הדף.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(severity);
  }, [severity, fetchData]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 style={{ font: "var(--type-page-title)", color: "var(--text-primary)" }}>שיחות עם ניקוד QA</h1>
        <div className="flex rounded-[var(--radius-2)] border border-[var(--border-field)] overflow-hidden">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setSeverity(f.value)}
              aria-pressed={severity === f.value}
              className="px-3 h-[var(--control-h)] text-[13px] font-medium transition-colors"
              style={{
                background: severity === f.value ? "var(--accent)" : "transparent",
                color: severity === f.value ? "var(--text-on-accent)" : "var(--text-secondary)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : error ? (
        <EmptyState title="שגיאה" subtitle={error} />
      ) : items.length === 0 ? (
        <EmptyState title="אין שיחות בטווח הזה" subtitle="שיחות עם ניקוד QA מ-30 הימים האחרונים יופיעו כאן." />
      ) : (
        <Card noPad>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-hairline)" }}>
                <th className="px-4 py-3 text-start text-[12px] font-semibold" style={{ color: "var(--text-faint)" }}>מתקשר</th>
                <th className="px-4 py-3 text-start text-[12px] font-semibold" style={{ color: "var(--text-faint)" }}>ציון כללי</th>
                <th className="px-4 py-3 text-start text-[12px] font-semibold" style={{ color: "var(--text-faint)" }}>חומרה</th>
                <th className="px-4 py-3 text-start text-[12px] font-semibold" style={{ color: "var(--text-faint)" }}>סיכום</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id}>
                  <td colSpan={4} className="p-0">
                    <Link
                      href={`/provider-admin/calls/${item.id}`}
                      className="grid grid-cols-4 items-center px-0 py-0 cursor-pointer"
                      style={{
                        borderBottom: i < items.length - 1 ? "1px solid var(--border-row)" : "none",
                      }}
                    >
                      <span className="px-4 py-3 text-[13.5px]" style={{ color: "var(--text-primary)" }}>
                        {item.conversationId}
                        <span className="block text-[11.5px]" style={{ color: "var(--text-faint)" }}>{fmtDate(item.createdAt)}</span>
                      </span>
                      <span className="px-4 py-3" style={{ font: "var(--type-metric)", color: "var(--text-primary)" }}>
                        {item.overallScore ?? "—"}
                      </span>
                      <span className="px-4 py-3">
                        <Badge tone={SEVERITY_TONE[item.exceptionSeverity ?? "none"]}>
                          {SEVERITY_LABEL[item.exceptionSeverity ?? "none"]}
                        </Badge>
                      </span>
                      <span className="px-4 py-3 text-[12.5px] truncate block" style={{ color: "var(--text-secondary)" }}>
                        {item.reviewerSummary ?? "—"}
                      </span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
