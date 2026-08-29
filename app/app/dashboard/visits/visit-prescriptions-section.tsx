"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/dashboard/ui/btn";
import { Badge } from "@/components/dashboard/ui/badge";
import type { Prescription } from "@/types/domain/prescription";

const PRESCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "פעיל",
  discontinued: "הופסק",
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
      <p className="text-xs text-[var(--muted)]">
        מרשם זה נרשם על ידי הצוות הווטרינרי בלבד. אין להסתמך על AI למינונים.
      </p>
      <ul className="space-y-2">
        {initialPrescriptions.length === 0 ? (
          <li className="text-sm text-[var(--faint)]">אין עדיין מרשמים.</li>
        ) : (
          initialPrescriptions.map((rx) => (
            <li key={rx.id} className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-[var(--ink)]">{rx.medicationName}</p>
                <Badge color={rx.status === "active" ? "green" : "muted"}>
                  {PRESCRIPTION_STATUS_LABELS[rx.status] ?? rx.status}
                </Badge>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[var(--ink-2)]">{rx.instructions}</p>
            </li>
          ))
        )}
      </ul>

      <form onSubmit={onSubmit} className="space-y-3 border-t border-[var(--line-2)] pt-4">
        <input
          value={medicationName}
          onChange={(event) => setMedicationName(event.target.value)}
          required
          placeholder="שם התרופה"
          className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-400)]"
        />
        <textarea
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          required
          rows={3}
          placeholder="מינון, תדירות, משך, הנחיות מיוחדות"
          className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-400)]"
        />
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="הערות (לא חובה)"
          className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-400)]"
        />
        {error ? <p className="text-sm font-semibold text-[var(--red-700)]">{error}</p> : null}
        <Btn type="submit" size="sm" loading={loading}>הוסף מרשם</Btn>
      </form>
    </div>
  );
}
