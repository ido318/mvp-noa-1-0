"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/dashboard/ui/btn";

type Props = {
  clinicId: string;
  customerId: string;
  petId: string;
  appointmentId?: string | null;
};

export function VisitForm({ clinicId, customerId, petId, appointmentId }: Props) {
  const router = useRouter();
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [manualVisitSummary, setManualVisitSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinicId,
        customerId,
        petId,
        appointmentId: appointmentId ?? null,
        chiefComplaint: chiefComplaint || null,
        manualVisitSummary: manualVisitSummary || null,
      }),
    });

    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      setError(payload.error?.message ?? "יצירת הביקור נכשלה");
      return;
    }

    const payload = (await response.json()) as { data: { id: string } };
    router.push(`/dashboard/visits/${payload.data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="chiefComplaint" className="mb-1 block text-sm font-semibold text-[var(--text-secondary)]">
          סיבת הביקור
        </label>
        <input
          id="chiefComplaint"
          value={chiefComplaint}
          onChange={(event) => setChiefComplaint(event.target.value)}
          className="w-full rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
        />
      </div>
      <div>
        <label htmlFor="manualVisitSummary" className="mb-1 block text-sm font-semibold text-[var(--text-secondary)]">
          סיכום ביקור ידני
        </label>
        <textarea
          id="manualVisitSummary"
          value={manualVisitSummary}
          onChange={(event) => setManualVisitSummary(event.target.value)}
          className="w-full rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
          rows={4}
        />
      </div>
      {appointmentId ? (
        <p className="text-sm text-[var(--text-muted)]">תור מקושר: {appointmentId}</p>
      ) : null}
      {error ? <p className="text-sm font-semibold text-[var(--red-700)]">{error}</p> : null}
      <Btn type="submit" loading={loading}>צור ביקור</Btn>
    </form>
  );
}
