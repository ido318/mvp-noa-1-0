"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "@/components/dashboard/icons";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: number;
}

export function Modal({ open, onClose, title, subtitle, children, maxWidth = 520 }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  // Portalled to document.body - see the matching comment in drawer.tsx for why
  // (the dashboard layout's .page-enter animation ends on a non-none transform,
  // which breaks `position: fixed` containment for descendants otherwise).
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(45,38,32,.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full bg-[var(--surface)] rounded-[var(--r-xl)] shadow-[var(--sh-pop)] modal-enter"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between p-6 pb-4 border-b border-[var(--line-2)]">
            <div>
              {title && <h2 className="text-[18px] font-bold text-[var(--ink)]">{title}</h2>}
              {subtitle && <p className="mt-0.5 text-sm text-[var(--muted)]">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="text-[var(--faint)] hover:text-[var(--ink-2)] transition-colors p-1 rounded-lg hover:bg-[var(--surface-2)]"
              aria-label="סגור"
            >
              <XIcon size={20} />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
