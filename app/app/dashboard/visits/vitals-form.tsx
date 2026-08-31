"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/dashboard/ui/btn";
import type { Vital } from "@/types/domain/vital";

function numberOrNull(value: string): number | null {
  return value.trim() ? Number(value) : null;
}

export function VitalsForm({
  visitId,
  initialVitals,
}: {
  visitId: string;
  initialVitals: Vital[];
}) {
  const router = useRouter();
  const [weightKg, setWeightKg] = useState("");
  const [temperatureC, setTemperatureC] = useState("");
  const [heartRateBpm, setHeartRateBpm] = useState("");
  const [respiratoryRateBpm, setRespiratoryRateBpm] = useState("");
  const [painScore, setPainScore] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/visits/${visitId}/vitals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weightKg: numberOrNull(weightKg),
        temperatureC: numberOrNull(temperatureC),
        heartRateBpm: numberOrNull(heartRateBpm),
        respiratoryRateBpm: numberOrNull(respiratoryRateBpm),
        painScore: numberOrNull(painScore),
        notes: notes.trim() || null,
      }),
    });

    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json()) as { error?: { message?: string } };
      setError(payload.error?.message ?? "שמירת המדדים נכשלה");
      return;
    }

    setWeightKg("");
    setTemperatureC("");
    setHeartRateBpm("");
    setRespiratoryRateBpm("");
    setPainScore("");
    setNotes("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {initialVitals.length > 0 && (
        <div className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">מדד אחרון</p>
          <p className="mt-1 text-sm font-semibold text-[var(--ink)]">
            {initialVitals[0]?.weightKg ?? "-"} קג · {initialVitals[0]?.temperatureC ?? "-"} C · {initialVitals[0]?.heartRateBpm ?? "-"} bpm
          </p>
        </div>
      )}

      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
        <input value={weightKg} onChange={(event) => setWeightKg(event.target.value)} type="number" step="0.01" placeholder="weightKg" className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm" />
        <input value={temperatureC} onChange={(event) => setTemperatureC(event.target.value)} type="number" step="0.1" placeholder="temperatureC" className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm" />
        <input value={heartRateBpm} onChange={(event) => setHeartRateBpm(event.target.value)} type="number" placeholder="heartRateBpm" className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm" />
        <input value={respiratoryRateBpm} onChange={(event) => setRespiratoryRateBpm(event.target.value)} type="number" placeholder="respiratoryRateBpm" className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm" />
        <input value={painScore} onChange={(event) => setPainScore(event.target.value)} type="number" min={0} max={10} placeholder="painScore" className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm" />
        <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="notes" className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm" />
        {error ? <p className="text-sm font-semibold text-[var(--red-700)] sm:col-span-2">{error}</p> : null}
        <div className="sm:col-span-2">
          <Btn type="submit" size="sm" loading={loading}>שמור מדדים</Btn>
        </div>
      </form>
    </div>
  );
}
