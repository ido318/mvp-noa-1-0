"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Vaccination } from "@/types/domain/vaccination";

type Props = {
  visitId: string;
  clinicId: string;
  customerId: string;
  petId: string;
  initialVaccinations: Vaccination[];
};

export function VisitVaccinationsSection({
  visitId,
  clinicId,
  customerId,
  petId,
  initialVaccinations,
}: Props) {
  const router = useRouter();
  const [vaccineName, setVaccineName] = useState("");
  const [administeredAt, setAdministeredAt] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const visitLinked = initialVaccinations.filter((v) => v.visitId === visitId);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/pets/${petId}/vaccinations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinicId,
        customerId,
        vaccineName,
        administeredAt: new Date(administeredAt).toISOString(),
        visitId,
        batchNumber: batchNumber || null,
      }),
    });

    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      setError(payload.error?.message ?? "שמירת החיסון נכשלה");
      return;
    }

    setVaccineName("");
    setAdministeredAt("");
    setBatchNumber("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {visitLinked.length === 0 ? (
          <li className="text-sm text-zinc-500">אין חיסונים שמקושרים לביקור הזה.</li>
        ) : (
          visitLinked.map((v) => (
            <li key={v.id} className="rounded-lg border border-zinc-100 p-3 text-sm">
              <p className="font-medium text-zinc-800">{v.vaccineName}</p>
              <p className="text-zinc-600">
                {new Date(v.administeredAt).toLocaleString()}
                {v.batchNumber ? ` · אצווה ${v.batchNumber}` : ""}
              </p>
            </li>
          ))
        )}
      </ul>

      <form onSubmit={onSubmit} className="space-y-3 border-t border-zinc-100 pt-4">
        <input
          value={vaccineName}
          onChange={(event) => setVaccineName(event.target.value)}
          required
          placeholder="שם החיסון"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <input
          type="datetime-local"
          value={administeredAt}
          onChange={(event) => setAdministeredAt(event.target.value)}
          required
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <input
          value={batchNumber}
          onChange={(event) => setBatchNumber(event.target.value)}
          placeholder="מספר אצווה (לא חובה)"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "שומר..." : "שמור חיסון"}
        </button>
      </form>
    </div>
  );
}
