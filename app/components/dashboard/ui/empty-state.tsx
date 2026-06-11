import React from "react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, subtitle, action, className = "" }: EmptyStateProps) {
  return (
    <div className={["flex flex-col items-center justify-center py-16 text-center", className].join(" ")}>
      {icon && (
        <span
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--faint)]"
          style={{ animation: "pawIn .5s var(--ease) both" }}
        >
          {icon}
        </span>
      )}
      <p className="text-[15px] font-semibold text-[var(--ink)]">{title}</p>
      {subtitle && <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
