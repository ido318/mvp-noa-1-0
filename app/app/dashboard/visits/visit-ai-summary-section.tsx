"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VisitStatus } from "@/types/domain/visit";

type Props = {
  visitId: string;
  visitVersion: number;
  visitStatus: VisitStatus;
  manualVisitSummary: string | null;
  aiVisitSummary: string | null;
  canUseAi: boolean;
};

export function VisitAiSummarySection({
  visitId,
  visitVersion,
  visitStatus,
  manualVisitSummary,
  aiVisitSummary,
  canUseAi,
}: Props) {
  const router = useRouter();
  const [draftText, setDraftText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canGenerate =
    canUseAi && visitStatus !== "cancelled" && draftText === null;

  async function onGenerate() {
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/visits/${visitId}/ai-summary/generate`, {
      method: "POST",
    });

    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      setError(payload.error?.message ?? "Failed to generate summary");
      return;
    }

    const payload = (await response.json()) as {
      data?: { draftText?: string };
    };
    setDraftText(payload.data?.draftText ?? "");
  }

  async function onAccept() {
    if (!draftText?.trim()) {
      setError("Summary text is required");
      return;
    }

    setLoading(true);
    setError(null);

    const response = await fetch(`/api/visits/${visitId}/ai-summary/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: visitVersion,
        summaryText: draftText.trim(),
      }),
    });

    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      setError(payload.error?.message ?? "Failed to accept summary");
      return;
    }

    setDraftText(null);
    router.refresh();
  }

  function onDiscard() {
    setDraftText(null);
    setError(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-zinc-800">Manual visit summary</h4>
        {manualVisitSummary ? (
          <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">
            {manualVisitSummary}
          </p>
        ) : (
          <p className="mt-1 text-sm text-zinc-500">No manual summary.</p>
        )}
      </div>

      <div className="border-t border-zinc-100 pt-4">
        <h4 className="text-sm font-medium text-zinc-800">AI visit summary</h4>
        <p className="mt-1 text-xs text-zinc-500">
          AI-generated drafts require veterinarian review before acceptance. Not for
          client communication.
        </p>

        {aiVisitSummary ? (
          <p className="mt-2 whitespace-pre-wrap rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-sm text-zinc-800">
            {aiVisitSummary}
          </p>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">No accepted AI summary yet.</p>
        )}

        {!canUseAi ? (
          <p className="mt-2 text-sm text-zinc-500">
            Elevated clinic role (owner, admin, or veterinarian) required to generate
            or accept AI summaries.
          </p>
        ) : null}

        {draftText !== null ? (
          <div className="mt-3 space-y-3">
            <label htmlFor="aiDraft" className="block text-sm font-medium text-zinc-700">
              Draft (editable)
            </label>
            <textarea
              id="aiDraft"
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              rows={8}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onAccept}
                disabled={loading}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {loading ? "Saving…" : "Accept summary"}
              </button>
              <button
                type="button"
                onClick={onDiscard}
                disabled={loading}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700"
              >
                Discard draft
              </button>
            </div>
          </div>
        ) : canGenerate ? (
          <button
            type="button"
            onClick={onGenerate}
            disabled={loading}
            className="mt-3 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-800 disabled:opacity-50"
          >
            {loading ? "Generating…" : "Generate draft"}
          </button>
        ) : null}

        {canUseAi && visitStatus !== "cancelled" && aiVisitSummary && draftText === null ? (
          <button
            type="button"
            onClick={onGenerate}
            disabled={loading}
            className="mt-3 rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 disabled:opacity-50"
          >
            {loading ? "Generating…" : "Regenerate draft"}
          </button>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
