"use client";
import React, { useState } from "react";
import { Btn } from "@/components/dashboard/ui/btn";
import { useToast } from "@/components/dashboard/ui/toast";

export function ApproveRejectModal({
  mode,
  appointmentId,
  phone,
  customerName,
  petName,
  onConfirm,
  onClose,
}: {
  mode: "approve" | "reject";
  appointmentId: string;
  phone: string;
  customerName: string;
  petName: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleConfirm() {
    setLoading(true);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, customerName, petName }),
      });
      if (!res.ok) throw new Error();
      toast(mode === "approve" ? "התור אושר ונשלח SMS ללקוח" : "התור נדחה ונשלח SMS ללקוח", "success");
      onConfirm();
    } catch {
      toast("שגיאה בעדכון התור", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-[var(--r-xl)] bg-[var(--surface)] p-6 shadow-[var(--sh-lg)] modal-enter"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-[15px] font-bold text-[var(--ink)]">
          {mode === "approve" ? "אישור תור עיקור/סירוס" : "דחיית תור עיקור/סירוס"}
        </h3>
        <p className="mt-2 text-sm text-[var(--ink-2)]">
          {mode === "approve"
            ? `האם לאשר את תורו של ${petName}? לאחר האישור ישלח SMS ל-${customerName}.`
            : `האם לדחות את תורו של ${petName}? לאחר הדחייה ישלח SMS ביטול ל-${customerName}.`}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="ghost" size="sm" onClick={onClose}>ביטול</Btn>
          <Btn
            variant={mode === "approve" ? "primary" : "danger"}
            size="sm"
            loading={loading}
            onClick={handleConfirm}
          >
            {mode === "approve" ? "אשר תור" : "דחה תור"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
