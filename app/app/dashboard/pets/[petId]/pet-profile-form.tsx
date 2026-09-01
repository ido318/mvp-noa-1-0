"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/dashboard/ui/btn";
import { useToast } from "@/components/dashboard/ui/toast";
import type { Pet } from "@/types/domain/pet";

type Props = {
  pet: Pet;
};

function nullableString(value: FormDataEntryValue | null): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function nullableNumber(value: FormDataEntryValue | null): number | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? Number(text) : null;
}

const fieldClass = "w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-normal text-[var(--ink)] outline-none focus:border-[var(--brand-400)]";
const labelClass = "space-y-1 text-sm font-semibold text-[var(--ink-2)]";

export function PetProfileForm({ pet }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: nullableString(formData.get("name")) ?? pet.name,
      species: nullableString(formData.get("species")) ?? pet.species,
      breed: nullableString(formData.get("breed")),
      sex: nullableString(formData.get("sex")),
      birthDate: nullableString(formData.get("birthDate")),
      weight: nullableNumber(formData.get("weight")),
      chipNumber: nullableString(formData.get("chipNumber")),
      isNeutered: formData.get("isNeutered") === "on",
      allergies: nullableString(formData.get("allergies")),
      chronicConditions: nullableString(formData.get("chronicConditions")),
      currentMedications: nullableString(formData.get("currentMedications")),
      notes: nullableString(formData.get("notes")),
      status: nullableString(formData.get("status")) ?? "active",
    };

    const response = await fetch(`/api/pets/${pet.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null) as {
        error?: { message?: string };
      } | null;
      const message = body?.error?.message ?? "שמירת פרטי החיה נכשלה";
      setError(message);
      toast(message, "error");
      return;
    }

    toast("פרטי החיה נשמרו", "success");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-[var(--ink)]">פרופיל רפואי</h3>
          <p className="mt-0.5 text-xs text-[var(--muted)]">פרטים קבועים שחייבים להיות זמינים בכל ביקור</p>
        </div>
        <Btn type="submit" size="sm" loading={saving}>שמור פרטים</Btn>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className={labelClass}>
          שם החיה
          <input name="name" defaultValue={pet.name} required className={fieldClass} />
        </label>
        <label className={labelClass}>
          סוג חיה
          <select name="species" defaultValue={pet.species} className={fieldClass}>
            <option value="dog">כלב</option>
            <option value="cat">חתול</option>
            <option value="other">אחר</option>
          </select>
        </label>
        <label className={labelClass}>
          גזע
          <input name="breed" defaultValue={pet.breed ?? ""} className={fieldClass} />
        </label>
        <label className={labelClass}>
          מין
          <select name="sex" defaultValue={pet.sex ?? ""} className={fieldClass}>
            <option value="">לא ידוע</option>
            <option value="male">זכר</option>
            <option value="female">נקבה</option>
          </select>
        </label>
        <label className={labelClass}>
          משקל בק״ג
          <input name="weight" type="number" step="0.01" min="0" defaultValue={pet.weight ?? ""} className={fieldClass} />
        </label>
        <label className={labelClass}>
          תאריך לידה
          <input name="birthDate" type="date" defaultValue={pet.birthDate ?? ""} className={fieldClass} />
        </label>
        <label className={labelClass}>
          מספר שבב
          <input name="chipNumber" defaultValue={pet.chipNumber ?? ""} className={fieldClass} />
        </label>
        <label className={labelClass}>
          סטטוס
          <select name="status" defaultValue={pet.status} className={fieldClass}>
            <option value="active">פעיל</option>
            <option value="inactive">לא פעיל</option>
          </select>
        </label>
        <label className="flex items-center gap-2 self-end rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm font-semibold text-[var(--ink-2)]">
          <input name="isNeutered" type="checkbox" defaultChecked={pet.isNeutered} />
          מעוקר / מסורס
        </label>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className={labelClass}>
          אלרגיות
          <textarea name="allergies" defaultValue={pet.allergies ?? ""} rows={3} className={fieldClass} />
        </label>
        <label className={labelClass}>
          מחלות כרוניות
          <textarea name="chronicConditions" defaultValue={pet.chronicConditions ?? ""} rows={3} className={fieldClass} />
        </label>
        <label className={labelClass}>
          תרופות קבועות
          <textarea name="currentMedications" defaultValue={pet.currentMedications ?? ""} rows={3} className={fieldClass} />
        </label>
        <label className={labelClass}>
          הערות
          <textarea name="notes" defaultValue={pet.notes ?? ""} rows={3} className={fieldClass} />
        </label>
      </div>

      {error ? <p className="mt-3 text-sm font-semibold text-[var(--red-700)]">{error}</p> : null}
    </form>
  );
}
