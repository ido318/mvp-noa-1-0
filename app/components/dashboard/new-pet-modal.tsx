"use client";
import React, { useState, useEffect, FormEvent } from "react";
import { Modal } from "@/components/dashboard/ui/modal";
import { Btn } from "@/components/dashboard/ui/btn";
import { useToast } from "@/components/dashboard/ui/toast";
import type { Pet } from "@/types/domain/pet";

const inputClass =
  "w-full rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--faint)] focus:outline-none focus:border-[var(--brand-400)]";
const labelClass = "mb-1 block text-xs font-semibold text-[var(--ink-2)]";

interface NewPetModalProps {
  open: boolean;
  onClose: () => void;
  clinicId: string;
  customerId: string;
  onCreated: (pet: Pet) => void;
}

export function NewPetModal({ open, onClose, clinicId, customerId, onCreated }: NewPetModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [breed, setBreed] = useState("");
  const [sex, setSex] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setName("");
    setSpecies("");
    setBreed("");
    setSex("");
  }

  // Clear stale input whenever the modal closes, whether via cancel, the X
  // button, Escape, or a backdrop click -- not just on a successful submit.
  useEffect(() => {
    if (!open) reset();
  }, [open]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 1) {
      toast("שם חייב להכיל לפחות תו אחד", "error");
      return;
    }
    if (species.trim().length < 1) {
      toast("יש להזין סוג חיה", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/pets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId,
          customerId,
          name: name.trim(),
          species: species.trim(),
          breed: breed.trim() || null,
          sex: sex.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();

      const created = (await res.json()) as { data: Pet };
      toast("החיה נוספה בהצלחה", "success");
      onCreated(created.data);
      onClose();
    } catch {
      toast("שגיאה בהוספת החיה", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="חיה חדשה" subtitle="הוספת חיית מחמד ידנית ללקוח">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="petName" className={labelClass}>שם *</label>
          <input
            id="petName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            required
            minLength={1}
          />
        </div>
        <div>
          <label htmlFor="petSpecies" className={labelClass}>סוג חיה *</label>
          <select
            id="petSpecies"
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
            className={inputClass}
            required
          >
            <option value="" disabled>בחר סוג חיה</option>
            <option value="dog">כלב</option>
            <option value="cat">חתול</option>
            <option value="other">אחר</option>
          </select>
        </div>
        <div>
          <label htmlFor="petBreed" className={labelClass}>גזע</label>
          <input
            id="petBreed"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="petSex" className={labelClass}>מין</label>
          <select
            id="petSex"
            value={sex}
            onChange={(e) => setSex(e.target.value)}
            className={inputClass}
          >
            <option value="">לא צוין</option>
            <option value="male">זכר</option>
            <option value="female">נקבה</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Btn type="button" variant="ghost" size="sm" onClick={onClose}>ביטול</Btn>
          <Btn type="submit" variant="primary" size="sm" loading={loading}>הוסף חיה</Btn>
        </div>
      </form>
    </Modal>
  );
}
