"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    <form onSubmit={onSubmit} className="rounded-2xl border border-zinc-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-zinc-900">פרופיל רפואי</h3>
          <p className="mt-1 text-sm text-zinc-500">פרטים קבועים שחייבים להיות זמינים לנועה בכל ביקור.</p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "שומר..." : "שמור פרטים"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1 text-sm font-semibold text-zinc-700">
          שם החיה
          <input name="name" defaultValue={pet.name} required className="w-full rounded-xl border border-zinc-200 px-3 py-2 font-normal" />
        </label>
        <label className="space-y-1 text-sm font-semibold text-zinc-700">
          סוג חיה
          <select name="species" defaultValue={pet.species} className="w-full rounded-xl border border-zinc-200 px-3 py-2 font-normal">
            <option value="dog">כלב</option>
            <option value="cat">חתול</option>
            <option value="other">אחר</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold text-zinc-700">
          גזע
          <input name="breed" defaultValue={pet.breed ?? ""} className="w-full rounded-xl border border-zinc-200 px-3 py-2 font-normal" />
        </label>
        <label className="space-y-1 text-sm font-semibold text-zinc-700">
          מין
          <select name="sex" defaultValue={pet.sex ?? ""} className="w-full rounded-xl border border-zinc-200 px-3 py-2 font-normal">
            <option value="">לא ידוע</option>
            <option value="male">זכר</option>
            <option value="female">נקבה</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold text-zinc-700">
          משקל בק״ג
          <input name="weight" type="number" step="0.01" min="0" defaultValue={pet.weight ?? ""} className="w-full rounded-xl border border-zinc-200 px-3 py-2 font-normal" />
        </label>
        <label className="space-y-1 text-sm font-semibold text-zinc-700">
          תאריך לידה
          <input name="birthDate" type="date" defaultValue={pet.birthDate ?? ""} className="w-full rounded-xl border border-zinc-200 px-3 py-2 font-normal" />
        </label>
        <label className="space-y-1 text-sm font-semibold text-zinc-700">
          מספר שבב
          <input name="chipNumber" defaultValue={pet.chipNumber ?? ""} className="w-full rounded-xl border border-zinc-200 px-3 py-2 font-normal" />
        </label>
        <label className="space-y-1 text-sm font-semibold text-zinc-700">
          סטטוס
          <select name="status" defaultValue={pet.status} className="w-full rounded-xl border border-zinc-200 px-3 py-2 font-normal">
            <option value="active">פעיל</option>
            <option value="inactive">לא פעיל</option>
          </select>
        </label>
        <label className="flex items-center gap-2 self-end rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700">
          <input name="isNeutered" type="checkbox" defaultChecked={pet.isNeutered} />
          מעוקר / מסורס
        </label>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="space-y-1 text-sm font-semibold text-zinc-700">
          אלרגיות
          <textarea name="allergies" defaultValue={pet.allergies ?? ""} rows={3} className="w-full rounded-xl border border-zinc-200 px-3 py-2 font-normal" />
        </label>
        <label className="space-y-1 text-sm font-semibold text-zinc-700">
          מחלות כרוניות
          <textarea name="chronicConditions" defaultValue={pet.chronicConditions ?? ""} rows={3} className="w-full rounded-xl border border-zinc-200 px-3 py-2 font-normal" />
        </label>
        <label className="space-y-1 text-sm font-semibold text-zinc-700">
          תרופות קבועות
          <textarea name="currentMedications" defaultValue={pet.currentMedications ?? ""} rows={3} className="w-full rounded-xl border border-zinc-200 px-3 py-2 font-normal" />
        </label>
        <label className="space-y-1 text-sm font-semibold text-zinc-700">
          הערות
          <textarea name="notes" defaultValue={pet.notes ?? ""} rows={3} className="w-full rounded-xl border border-zinc-200 px-3 py-2 font-normal" />
        </label>
      </div>

      {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
    </form>
  );
}
