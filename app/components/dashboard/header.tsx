"use client";
import React from "react";
import Link from "next/link";
import { SearchIcon, BellIcon } from "@/components/dashboard/icons";

interface HeaderProps {
  clinicName?: string;
  clinicLocation?: string;
  openEscalations?: number;
}

export function Header({
  clinicName = "Get A Vet",
  clinicLocation = "מגדלי גינדי TLV · תל אביב",
  openEscalations = 0,
}: HeaderProps) {
  return (
    <header
      className="flex items-center gap-4 px-6 bg-[var(--surface)] border-b border-[var(--line)] flex-shrink-0"
      style={{ height: "var(--header-h)" }}
    >
      {/* Search */}
      <div className="flex-1 max-w-[440px]">
        <label className="flex items-center gap-2 px-3 h-9 rounded-[var(--r-md)] bg-[var(--surface-2)] border border-[var(--line)] text-[var(--faint)] focus-within:border-[var(--brand-300)] focus-within:ring-2 focus-within:ring-[var(--brand-100)] transition-all">
          <SearchIcon size={16} className="flex-shrink-0" />
          <input
            type="search"
            placeholder="חיפוש לקוח, חיה, תור..."
            className="flex-1 bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--faint)] outline-none"
          />
        </label>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Clinic info */}
      <div className="text-end">
        <p className="text-[13.5px] font-semibold text-[var(--ink)]">{clinicName}</p>
        <p className="text-[11px] text-[var(--muted)]">{clinicLocation}</p>
      </div>

      {/* Separator */}
      <div className="h-7 w-px bg-[var(--line)]" />

      {/* Bell */}
      <Link
        href="/dashboard/escalations"
        className="relative flex items-center justify-center h-9 w-9 rounded-[var(--r-md)] text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--brand-600)] transition-colors"
        aria-label={`${openEscalations} אסקלציות פתוחות`}
      >
        <BellIcon size={20} />
        {openEscalations > 0 && (
          <span className="absolute -top-0.5 -end-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[var(--red-500)] text-white text-[9px] font-bold px-1 leading-none">
            {openEscalations}
          </span>
        )}
      </Link>
    </header>
  );
}
