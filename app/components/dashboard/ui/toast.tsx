"use client";
import React, { createContext, useContext, useCallback, useState } from "react";
import { XIcon } from "@/components/dashboard/icons";

type ToastVariant = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  variant?: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

/** A single colour mark carries the variant — the system uses no icon badge here. */
const VARIANT_MARK: Record<ToastVariant, string> = {
  success: "var(--status-done-text)",
  error:   "var(--clay-700)",
  warning: "var(--status-pending-text)",
  info:    "var(--slate-600)",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container — bottom-start (left in RTL) */}
      <div className="fixed bottom-6 start-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={(id) => setToasts((p) => p.filter((x) => x.id !== id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const variant = toast.variant ?? "success";

  return (
    <div
      className="pointer-events-auto flex items-center gap-3 min-w-[260px] max-w-sm px-4 py-3 toast-enter"
      style={{
        background: "var(--graphite-800)",
        color: "#fff",
        borderRadius: "var(--radius-2)",
        boxShadow: "var(--shadow-modal)",
      }}
    >
      <span
        aria-hidden="true"
        className="flex-shrink-0"
        style={{
          width: "var(--mark-size)",
          height: "var(--mark-size)",
          borderRadius: "1px",
          background: VARIANT_MARK[variant],
        }}
      />
      <p className="flex-1 text-[13px]" style={{ fontWeight: "var(--w-medium)" }}>{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 opacity-60 hover:opacity-100"
        style={{ transition: "opacity var(--dur-fast) var(--ease)" }}
        aria-label="סגור"
      >
        <XIcon size={14} />
      </button>
    </div>
  );
}
