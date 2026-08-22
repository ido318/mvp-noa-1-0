"use client";
import React, { createContext, useContext, useCallback, useState } from "react";
import { CheckIcon, EscalationIcon, XIcon } from "@/components/dashboard/icons";

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

const VARIANT_ICON: Record<ToastVariant, React.ReactNode> = {
  success: <CheckIcon size={14} />,
  error:   <XIcon size={14} />,
  warning: <EscalationIcon size={14} />,
  info:    <CheckIcon size={14} />,
};

const VARIANT_COLOR: Record<ToastVariant, string> = {
  success: "bg-[var(--brand-600)]",
  error:   "bg-[var(--red-600)]",
  warning: "bg-[var(--amber-600)]",
  info:    "bg-[var(--brand-500)]",
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
      className="pointer-events-auto flex items-center gap-3 min-w-[260px] max-w-sm px-4 py-3 rounded-[var(--r-md)] shadow-[var(--sh-pop)] toast-enter"
      style={{ backgroundColor: "var(--ink)", color: "#fff" }}
    >
      <span className={["flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full text-white", VARIANT_COLOR[variant]].join(" ")}>
        {VARIANT_ICON[variant]}
      </span>
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="סגור"
      >
        <XIcon size={14} />
      </button>
    </div>
  );
}
