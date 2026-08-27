"use client";
import React, { useState, useEffect, FormEvent } from "react";
import { Modal } from "@/components/dashboard/ui/modal";
import { Btn } from "@/components/dashboard/ui/btn";
import { useToast } from "@/components/dashboard/ui/toast";
import type { Customer } from "@/types/domain/customer";

const inputClass =
  "w-full rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--faint)] focus:outline-none focus:border-[var(--brand-400)]";
const labelClass = "mb-1 block text-xs font-semibold text-[var(--ink-2)]";

interface NewCustomerModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
}

export function NewCustomerModal({ open, onClose, onCreated }: NewCustomerModalProps) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setFullName("");
    setPhone("");
    setEmail("");
  }

  // Clear stale input whenever the modal closes, whether via cancel, the X
  // button, Escape, or a backdrop click -- not just on a successful submit.
  useEffect(() => {
    if (!open) reset();
  }, [open]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (fullName.trim().length < 2) {
      toast("שם מלא חייב להכיל לפחות 2 תווים", "error");
      return;
    }

    setLoading(true);
    try {
      const meRes = await fetch("/api/me");
      if (!meRes.ok) throw new Error();
      const me = (await meRes.json()) as { data: { memberships: { clinicId: string }[] } };
      const clinicId = me.data.memberships[0]?.clinicId;
      if (!clinicId) throw new Error();

      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId,
          fullName: fullName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();

      const created = (await res.json()) as { data: Customer };
      toast("הלקוח נוסף בהצלחה", "success");
      onCreated(created.data);
      onClose();
    } catch {
      toast("שגיאה בהוספת הלקוח", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="לקוח חדש" subtitle="הוספת לקוח ידנית לדשבורד">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="fullName" className={labelClass}>שם מלא *</label>
          <input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
            required
            minLength={2}
          />
        </div>
        <div>
          <label htmlFor="phone" className={labelClass}>טלפון</label>
          <input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
            dir="ltr"
          />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>אימייל</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            dir="ltr"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Btn type="button" variant="ghost" size="sm" onClick={onClose}>ביטול</Btn>
          <Btn type="submit" variant="primary" size="sm" loading={loading}>הוסף לקוח</Btn>
        </div>
      </form>
    </Modal>
  );
}
