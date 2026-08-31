import React from "react";

export function ActiveProblems({ problems }: { problems: unknown[] }) {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">בעיות פעילות</p>
      <div className="mt-2 space-y-1">
        {problems.length === 0 ? (
          <p className="text-sm text-[var(--faint)]">אין בעיות פעילות רשומות.</p>
        ) : (
          problems.map((problem, index) => (
            <p key={index} className="rounded-[var(--r-sm)] bg-[var(--surface-2)] px-2 py-1 text-xs font-semibold text-[var(--ink)]">
              {String(problem)}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
