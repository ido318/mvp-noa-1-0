"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { VisitStatus } from "@/types/domain/visit";

const STATUS_OPTIONS: VisitStatus[] = ["in_progress", "completed", "cancelled"];

const STATUS_LABELS: Record<VisitStatus, string> = {
  in_progress: "בטיפול",
  completed: "הושלם",
  cancelled: "בוטל",
};

type Props = {
  visitId: string;
  currentVersion: number;
  currentStatus: VisitStatus;
};

export function VisitActions({ visitId, currentVersion, currentStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<VisitStatus>(currentStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus() {
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/visits/${visitId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: currentVersion, status }),
    });

    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      setError(payload.error?.message ?? "עדכון הסטטוס נכשל");
      return;
    }
    router.refresh();
  }

  async function softDelete() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/visits/${visitId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: currentVersion }),
    });
    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      setError(payload.error?.message ?? "מחיקת הביקור נכשלה");
      return;
    }
    router.push("/dashboard/visits");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700" htmlFor="status">
          שינוי סטטוס
        </label>
        <select
          id="status"
          value={status}
          onChange={(event) => setStatus(event.target.value as VisitStatus)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={updateStatus}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "שומר..." : "עדכן סטטוס"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={softDelete}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-60"
        >
          מחק ביקור
        </button>
      </div>
    </div>
  );
}
