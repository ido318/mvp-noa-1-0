"use client";
import React, { useEffect } from "react";
import { XIcon } from "@/components/dashboard/icons";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: number;
  footer?: React.ReactNode;
}

export function Drawer({ open, onClose, title, children, width = 460, footer }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(45,38,32,.4)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />
      {/* Panel — slides from the start (right in RTL) */}
      <div
        className="absolute inset-y-0 end-0 flex flex-col bg-[var(--surface)] shadow-[var(--sh-pop)] drawer-enter"
        style={{ width }}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line-2)] flex-shrink-0">
          {title ? (
            <h2 className="text-[15px] font-bold text-[var(--ink)]">{title}</h2>
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            className="text-[var(--faint)] hover:text-[var(--ink-2)] transition-colors p-1.5 rounded-lg hover:bg-[var(--surface-2)]"
            aria-label="סגור"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-[var(--line-2)] px-6 py-4 flex-shrink-0 bg-[var(--surface)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
