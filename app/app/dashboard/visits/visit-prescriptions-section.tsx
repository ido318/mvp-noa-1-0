"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Prescription } from "@/types/domain/prescription";

type Props = {
  visitId: string;
  initialPrescriptions: Prescription[];
};

export function VisitPrescriptionsSection({ visitId, initialPrescriptions }: Props) {
  const router = useRouter();
  const [medicationName, setMedicationName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/visits/${visitId}/prescriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        medicationName,
        instructions,
        notes: notes || null,
      }),
    });

    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      setError(payload.error?.message ?? "Failed to add prescription");
      return;
    }

    setMedicationName("");
    setInstructions("");
    setNotes("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        Veterinarian-entered prescription record only — not AI dosing advice.
      </p>
      <ul className="space-y-2">
        {initialPrescriptions.length === 0 ? (
          <li className="text-sm text-zinc-500">No prescriptions yet.</li>
        ) : (
          initialPrescriptions.map((rx) => (
            <li key={rx.id} className="rounded-lg border border-zinc-100 p-3 text-sm">
              <p className="font-medium text-zinc-800">
                {rx.medicationName} · {rx.status}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-zinc-700">{rx.instructions}</p>
            </li>
          ))
        )}
      </ul>

      <form onSubmit={onSubmit} className="space-y-3 border-t border-zinc-100 pt-4">
        <input
          value={medicationName}
          onChange={(event) => setMedicationName(event.target.value)}
          required
          placeholder="Medication name"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <textarea
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          required
          rows={3}
          placeholder="Instructions (human-written)"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Notes (optional)"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Saving..." : "Add prescription"}
        </button>
      </form>
    </div>
  );
}
