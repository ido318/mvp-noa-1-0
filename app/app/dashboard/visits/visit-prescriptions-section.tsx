"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Prescription } from "@/types/domain/prescription";

const PRESCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "פעיל",
  stopped: "הופסק",
  completed: "הושלם",
  cancelled: "בוטל",
};

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
      setError(payload.error?.message ?? "הוספת המרשם נכשלה");
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
        מרשם זה נרשם על ידי הצוות הווטרינרי בלבד. אין להסתמך על AI למינונים.
      </p>
      <ul className="space-y-2">
        {initialPrescriptions.length === 0 ? (
          <li className="text-sm text-zinc-500">אין עדיין מרשמים.</li>
        ) : (
          initialPrescriptions.map((rx) => (
            <li key={rx.id} className="rounded-lg border border-zinc-100 p-3 text-sm">
              <p className="font-medium text-zinc-800">
                {rx.medicationName} · {PRESCRIPTION_STATUS_LABELS[rx.status] ?? rx.status}
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
          placeholder="שם התרופה"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <textarea
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          required
          rows={3}
          placeholder="הנחיות שימוש שנכתבו על ידי הצוות"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="הערות (לא חובה)"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "שומר..." : "הוסף מרשם"}
        </button>
      </form>
    </div>
  );
}
