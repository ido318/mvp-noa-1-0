"use client";
import { useEffect } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Moves focus into the panel on open, restores it on close, and keeps Tab
 * cycling inside — shared by Modal and Drawer so an overlay never leaks
 * keyboard focus to the page behind it.
 */
export function useFocusTrap(ref: React.RefObject<HTMLElement | null>, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const panel = ref.current;
    if (!panel) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));

    const firstFocusTimer = window.setTimeout(() => {
      (focusables()[0] ?? panel).focus();
    }, 0);

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleTab);
    return () => {
      window.clearTimeout(firstFocusTimer);
      window.removeEventListener("keydown", handleTab);
      previouslyFocused?.focus();
    };
  }, [open, ref]);
}
