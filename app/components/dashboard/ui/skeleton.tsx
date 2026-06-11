import React from "react";

interface SkeletonProps {
  className?: string;
  height?: number | string;
  width?: number | string;
}

export function Skeleton({ className = "", height, width }: SkeletonProps) {
  return (
    <span
      className={["skeleton block", className].join(" ")}
      style={{ height, width }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={["bg-[var(--surface)] border border-[var(--line)] rounded-[var(--r-lg)] p-[18px] space-y-3", className].join(" ")}>
      <Skeleton height={16} width="60%" />
      <Skeleton height={12} width="80%" />
      <Skeleton height={12} width="40%" />
    </div>
  );
}

export function SkeletonRow({ className = "" }: { className?: string }) {
  return (
    <div className={["flex items-center gap-4 px-4 py-3", className].join(" ")}>
      <Skeleton height={36} width={36} className="rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton height={13} width="50%" />
        <Skeleton height={11} width="70%" />
      </div>
      <Skeleton height={22} width={60} className="rounded-full" />
    </div>
  );
}
