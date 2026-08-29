"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/dashboard/ui/btn";
import { Badge } from "@/components/dashboard/ui/badge";
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
      setError(payload.error?.message ?? "יצירת סיכום AI נכשלה");
      return;
    }

    const payload = (await response.json()) as {
      data?: { draftText?: string };
    };
    setDraftText(payload.data?.draftText ?? "");
  }

  async function onAccept() {
    if (!draftText?.trim()) {
      setError("חובה להזין טקסט סיכום");
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
      setError(payload.error?.message ?? "שמירת הסיכום נכשלה");
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
        <h4 className="text-sm font-bold text-[var(--ink)]">סיכום ביקור ידני</h4>
        {manualVisitSummary ? (
          <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--ink-2)]">
            {manualVisitSummary}
          </p>
        ) : (
          <p className="mt-1 text-sm text-[var(--faint)]">אין עדיין סיכום ידני.</p>
        )}
      </div>

      <div className="border-t border-[var(--line-2)] pt-4">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold text-[var(--ink)]">סיכום ביקור AI</h4>
          <Badge color="brand">AI</Badge>
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          טיוטות AI מחייבות בדיקה ואישור של וטרינר לפני שימוש. לא לשליחה ישירה
          ללקוח.
        </p>

        {aiVisitSummary ? (
          <p className="mt-2 whitespace-pre-wrap rounded-[var(--r-md)] border border-[var(--brand-200)] bg-[var(--brand-50)] p-3 text-sm text-[var(--ink)]">
            {aiVisitSummary}
          </p>
        ) : (
          <p className="mt-2 text-sm text-[var(--faint)]">אין עדיין סיכום AI מאושר.</p>
        )}

        {!canUseAi ? (
          <p className="mt-2 text-sm text-[var(--faint)]">
            יצירה או אישור של סיכומי AI זמינים רק לבעלים, מנהל או וטרינר.
          </p>
        ) : null}

        {draftText !== null ? (
          <div className="mt-3 space-y-3">
            <label htmlFor="aiDraft" className="block text-sm font-semibold text-[var(--ink-2)]">
              טיוטה לעריכה
            </label>
            <textarea
              id="aiDraft"
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              rows={8}
              className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-400)]"
            />
            <div className="flex flex-wrap gap-2">
              <Btn size="sm" loading={loading} onClick={onAccept}>אשר סיכום</Btn>
              <Btn size="sm" variant="ghost" disabled={loading} onClick={onDiscard}>מחק טיוטה</Btn>
            </div>
          </div>
        ) : canGenerate ? (
          <div className="mt-3">
            <Btn size="sm" variant="soft" loading={loading} onClick={onGenerate}>צור טיוטה</Btn>
          </div>
        ) : null}

        {canUseAi && visitStatus !== "cancelled" && aiVisitSummary && draftText === null ? (
          <div className="mt-3">
            <Btn size="sm" variant="ghost" loading={loading} onClick={onGenerate}>צור טיוטה מחדש</Btn>
          </div>
        ) : null}

        {error ? <p className="mt-2 text-sm font-semibold text-[var(--red-700)]">{error}</p> : null}
      </div>
    </div>
  );
}
