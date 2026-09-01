import React from "react";
import { Badge } from "@/components/dashboard/ui/badge";
import { formatIsraelDate } from "@/lib/israel-date";
import type { ProblemListEntry, ProblemListSeverity } from "@/types/domain/medical-record";

export const PROBLEM_SEVERITY_LABELS: Record<ProblemListSeverity, string> = {
  mild: "קל",
  moderate: "בינוני",
  severe: "חמור",
};

const SEVERITY_BADGE_COLOR: Record<ProblemListSeverity, "green" | "amber" | "red"> = {
  mild: "green",
  moderate: "amber",
  severe: "red",
};

// The DB CHECK constraint on active_problem_list only enforces "is a jsonb
// array" — it does not guarantee onsetDate is a parseable date. formatIsraelDate
// throws on an invalid value, so guard it rather than let one bad legacy/manual
// row crash this whole tab.
function formatOnsetDate(value: string): string {
  return Number.isNaN(new Date(value).getTime()) ? value : formatIsraelDate(value);
}

export function ActiveProblems({ problems }: { problems: ProblemListEntry[] }) {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">בעיות פעילות</p>
      <div className="mt-2 space-y-1.5">
        {problems.length === 0 ? (
          <p className="text-sm text-[var(--faint)]">אין בעיות פעילות רשומות.</p>
        ) : (
          problems.map((problem, index) => (
            <div key={index} className="rounded-[var(--r-sm)] bg-[var(--surface-2)] px-2 py-1.5 text-xs text-[var(--ink)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-[var(--ink)]">
                  <span className="font-normal text-[var(--muted)]">מצב: </span>
                  {problem.condition}
                </p>
                {problem.severity && (
                  <Badge color={SEVERITY_BADGE_COLOR[problem.severity]}>
                    {PROBLEM_SEVERITY_LABELS[problem.severity]}
                  </Badge>
                )}
              </div>
              {(problem.onsetDate || problem.notes) && (
                <div className="mt-1 space-y-0.5 text-[11px] text-[var(--muted)]">
                  {problem.onsetDate && <p>תאריך תחילה: {formatOnsetDate(problem.onsetDate)}</p>}
                  {problem.notes && <p>הערות: {problem.notes}</p>}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
