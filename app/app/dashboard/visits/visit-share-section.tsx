"use client";

import { useState } from "react";

type Props = {
  visitId: string;
  hasSummary: boolean;
  hasPrescriptions: boolean;
};

type ShareResult = { url: string; recipientPhone: string };

export function VisitShareSection({ visitId, hasSummary, hasPrescriptions }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShareResult | null>(null);
  const [copied, setCopied] = useState(false);

  const nothingToSend = !hasSummary && !hasPrescriptions;

  async function sendShare() {
    setLoading(true);
    setError(null);
    setCopied(false);

    const response = await fetch(`/api/visits/${visitId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      setError(payload.error?.message ?? "שליחת הקישור נכשלה");
      return;
    }
    const payload = (await response.json()) as { data: ShareResult };
    setResult(payload.data);
  }

  async function copyLink() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">
        שליחת קישור מאובטח ללקוח ב-SMS עם סיכום הביקור והמרשמים.
      </p>

      {nothingToSend ? (
        <p className="text-sm text-amber-700">
          כדי לשלוח, צריך קודם סיכום ביקור או מרשם פעיל.
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {result ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <p className="font-medium text-emerald-800">
            נשלח ל-{result.recipientPhone} ✓
          </p>
          <div className="mt-2 flex items-center gap-2">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-emerald-700 underline"
            >
              {result.url}
            </a>
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 rounded-lg border border-emerald-300 px-2 py-1 text-xs text-emerald-700"
            >
              {copied ? "הועתק" : "העתק"}
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        disabled={loading || nothingToSend}
        onClick={sendShare}
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {loading ? "שולח..." : result ? "שלח שוב" : "שלח סיכום ומרשם ללקוח ב-SMS"}
      </button>
    </div>
  );
}
