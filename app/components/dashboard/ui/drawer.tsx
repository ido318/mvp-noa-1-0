"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "@/components/dashboard/icons";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  width?: number;
  footer?: React.ReactNode;
}

export function Drawer({ open, onClose, title, subtitle, children, width, footer }: DrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  // Portalled to document.body: an ancestor with a non-none `transform` becomes
  // the containing block for `position: fixed` descendants, which would position
  // this panel against the scrollable page content instead of the viewport.
  return createPortal(
    <div className="fixed inset-0 z-40">
      {/* Scrim — a flat wash; the system uses no blur on overlays. */}
      <div
        className="absolute inset-0"
        style={{ background: "var(--scrim)" }}
        onClick={onClose}
      />
      {/* Panel — anchored to the inline end, opposite the navigation rail. */}
      <aside
        className="absolute inset-y-0 end-0 flex flex-col drawer-enter"
        style={{
          width: width ?? "var(--drawer-w)",
          maxWidth: "94vw",
          background: "var(--surface-raised)",
          boxShadow: "var(--shadow-drawer)",
        }}
        role="dialog"
        aria-modal="true"
      >
        <header
          className="flex items-center gap-3 flex-shrink-0 px-5"
          style={{ height: "var(--drawer-head-h)", borderBottom: "var(--rule)" }}
        >
          <div className="min-w-0">
            {title && (
              <p
                className="text-[14px] truncate"
                style={{ color: "var(--text-primary)", fontWeight: "var(--w-semibold)" }}
              >
                {title}
              </p>
            )}
            {subtitle && (
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ms-auto grid place-items-center flex-shrink-0 w-[26px] h-[26px]"
            style={{
              borderRadius: "var(--radius-2)",
              color: "var(--text-faint)",
              transition: "var(--transition-color)",
            }}
            aria-label="סגור"
          >
            <XIcon size={16} />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>

        {footer && (
          <footer
            className="flex items-center gap-2 flex-shrink-0 px-5 py-3"
            style={{ borderTop: "var(--rule)", background: "var(--surface-raised)" }}
          >
            {footer}
          </footer>
        )}
      </aside>
    </div>,
    document.body,
  );
}

export function DrawerSection({
  label,
  children,
  className = "",
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={["px-5 py-4", className].join(" ")}
      style={{ borderBottom: "var(--rule-row)" }}
    >
      {label && <div className="gv-section-label mb-2">{label}</div>}
      {children}
    </section>
  );
}
