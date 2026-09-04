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
            {initialVitals[0]?.weightKg ?? "-"} ק&quot;ג · {initialVitals[0]?.temperatureC ?? "-"}°C · {initialVitals[0]?.heartRateBpm ?? "-"} פעימות/דקה
          </p>
        </div>
      )}

      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-[var(--ink-2)]">משקל (ק&quot;ג)</span>
          <input value={weightKg} onChange={(event) => setWeightKg(event.target.value)} type="number" step="0.01" className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-[var(--ink-2)]">טמפרטורה (°C)</span>
          <input value={temperatureC} onChange={(event) => setTemperatureC(event.target.value)} type="number" step="0.1" className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-[var(--ink-2)]">דופק (פעימות/דקה)</span>
          <input value={heartRateBpm} onChange={(event) => setHeartRateBpm(event.target.value)} type="number" className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-[var(--ink-2)]">קצב נשימה (נשימות/דקה)</span>
          <input value={respiratoryRateBpm} onChange={(event) => setRespiratoryRateBpm(event.target.value)} type="number" className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-[var(--ink-2)]">ציון כאב (0-10)</span>
          <input value={painScore} onChange={(event) => setPainScore(event.target.value)} type="number" min={0} max={10} className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-[var(--ink-2)]">הערות</span>
          <input value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm" />
        </label>
        {error ? <p className="text-sm font-semibold text-[var(--red-700)] sm:col-span-2">{error}</p> : null}
        <div className="sm:col-span-2">
          <Btn type="submit" size="sm" loading={loading}>שמור מדדים</Btn>
        </div>
      </form>
    </div>
  );
}
