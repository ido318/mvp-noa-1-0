"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Btn } from "@/components/dashboard/ui/btn";

export function CloseVisitModal({
  visitId,
  version,
}: {
  visitId: string;
  version: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpReason, setFollowUpReason] = useState("");
  const [followUpDueAt, setFollowUpDueAt] = useState("");
  const [loading, setLoading] = useState(false);

  async function closeVisit() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/visits/${visitId}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version,
        followUp: followUpEnabled
          ? {
              reason: followUpReason,
              dueAt: new Date(followUpDueAt).toISOString(),
            }
          : undefined,
      }),
    });
    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json()) as { error?: { message?: string } };
      setError(payload.error?.message ?? "סגירת הביקור נכשלה");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-2)]">
        <input
          type="checkbox"
          checked={followUpEnabled}
          onChange={(event) => setFollowUpEnabled(event.target.checked)}
        />
        צור מעקב אחרי סגירת הביקור
      </label>
      {followUpEnabled ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
          <input
            value={followUpReason}
            onChange={(event) => setFollowUpReason(event.target.value)}
            placeholder="סיבת מעקב"
            className="h-10 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-400)]"
          />
          <input
            type="datetime-local"
            value={followUpDueAt}
            onChange={(event) => setFollowUpDueAt(event.target.value)}
            className="h-10 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-400)]"
          />
        </div>
      ) : null}
      {error ? <p className="text-sm font-semibold text-[var(--red-700)]">{error}</p> : null}
      <Btn
        type="button"
        loading={loading}
        disabled={followUpEnabled && (!followUpReason.trim() || !followUpDueAt)}
        onClick={closeVisit}
      >
        סגור ביקור
      </Btn>
    </div>
  );
}
