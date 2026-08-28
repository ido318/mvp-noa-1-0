"use client";
import React, { useState, useEffect, useRef, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SearchIcon, BellIcon } from "@/components/dashboard/icons";
import { formatSearchResults, type SearchResultRow } from "@/lib/search/format-search-results";
import { useToast } from "@/components/dashboard/ui/toast";
import type { Customer } from "@/types/domain/customer";
import type { Pet } from "@/types/domain/pet";

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
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    // Bump the token on every run so a slower, earlier-started fetch can
    // recognize it's been superseded and skip updating state when it resolves.
    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;

    if (trimmed.length < 2) {
      startTransition(() => {
        setResults([]);
        setOpen(false);
        setLoading(false);
      });
      return;
    }

    startTransition(() => {
      setLoading(true);
    });
    const t = setTimeout(() => {
      void (async () => {
        try {
          const [customersRes, petsRes] = await Promise.all([
            fetch(`/api/search?entity=customers&q=${encodeURIComponent(trimmed)}`),
            fetch(`/api/search?entity=pets&q=${encodeURIComponent(trimmed)}`),
          ]);
          if (!customersRes.ok || !petsRes.ok) {
            throw new Error("search request failed");
          }
          const customersData = (await customersRes.json()) as { data: { customers: Customer[] } };
          const petsData = (await petsRes.json()) as { data: { pets: Pet[] } };
          if (requestIdRef.current !== currentRequestId) return; // a newer search superseded this one
          setResults(formatSearchResults(customersData.data.customers, petsData.data.pets));
          setOpen(true);
        } catch {
          if (requestIdRef.current !== currentRequestId) return;
          setResults([]);
          setOpen(false);
          toast("החיפוש נכשל, נסי שוב", "error");
        } finally {
          if (requestIdRef.current === currentRequestId) setLoading(false);
        }
      })();
    }, 300);

    return () => clearTimeout(t);
  }, [query, toast, startTransition]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const goToResult = useCallback((row: SearchResultRow) => {
    setOpen(false);
    setQuery("");
    router.push(`/dashboard/clients?customerId=${row.customerId}`);
  }, [router]);

  return (
    <header
      className="flex items-center gap-4 px-6 bg-[var(--surface)] border-b border-[var(--line)] flex-shrink-0"
      style={{ height: "var(--header-h)" }}
    >
      {/* Search */}
      <div className="relative flex-1 max-w-[440px]" ref={containerRef}>
        <label className="flex items-center gap-2 px-3 h-9 rounded-[var(--r-md)] bg-[var(--surface-2)] border border-[var(--line)] text-[var(--faint)] focus-within:border-[var(--brand-300)] focus-within:ring-2 focus-within:ring-[var(--brand-100)] transition-all">
          <SearchIcon size={16} className="flex-shrink-0" />
          <input
            type="search"
            placeholder="חיפוש לקוח, חיה..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (results.length > 0) setOpen(true); }}
            className="flex-1 bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--faint)] outline-none"
          />
          {loading && (
            <span className="h-3.5 w-3.5 rounded-full border-2 border-[var(--brand-400)] border-t-transparent animate-spin" />
          )}
        </label>

        {open && (
          <div className="absolute top-full mt-2 w-full rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-lg)] overflow-hidden z-30">
            {results.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-[var(--faint)]">אין תוצאות</p>
            ) : (
              <ul>
                {results.map((row) => (
                  <li key={`${row.kind}-${row.id}`}>
                    <button
                      onClick={() => goToResult(row)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-start hover:bg-[var(--surface-2)] transition-colors"
                    >
                      <span className="text-[13.5px] font-semibold text-[var(--ink)]">{row.title}</span>
                      <span className="text-[11px] text-[var(--muted)]">
                        {row.kind === "pet" ? `🐾 ${row.subtitle}` : row.subtitle}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
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
