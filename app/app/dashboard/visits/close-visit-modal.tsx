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
  const [loading, setLoading] = useState(false);

  async function closeVisit() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/visits/${visitId}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version }),
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
    <div className="space-y-2">
      {error ? <p className="text-sm font-semibold text-[var(--red-700)]">{error}</p> : null}
      <Btn type="button" loading={loading} onClick={closeVisit}>סגור ביקור</Btn>
    </div>
  );
}
