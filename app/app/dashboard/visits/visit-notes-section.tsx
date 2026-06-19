"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { MedicalNote, MedicalNoteType } from "@/types/domain/medical-note";

const NOTE_TYPES: MedicalNoteType[] = [
  "general",
  "soap_subjective",
  "soap_objective",
  "soap_assessment",
  "soap_plan",
  "follow_up",
];

const NOTE_TYPE_LABELS: Record<MedicalNoteType, string> = {
  general: "כללי",
  soap_subjective: "SOAP - תלונת לקוח",
  soap_objective: "SOAP - ממצאים",
  soap_assessment: "SOAP - הערכה",
  soap_plan: "SOAP - תוכנית טיפול",
  follow_up: "מעקב",
};

type Props = {
  visitId: string;
  initialNotes: MedicalNote[];
};

export function VisitNotesSection({ visitId, initialNotes }: Props) {
  const router = useRouter();
  const [noteType, setNoteType] = useState<MedicalNoteType>("general");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/visits/${visitId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteType, content }),
    });

    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      setError(payload.error?.message ?? "הוספת ההערה נכשלה");
      return;
    }

    setContent("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {initialNotes.length === 0 ? (
          <li className="text-sm text-zinc-500">אין עדיין הערות.</li>
        ) : (
          initialNotes.map((note) => (
            <li key={note.id} className="rounded-lg border border-zinc-100 p-3 text-sm">
              <p className="font-medium text-zinc-800">{NOTE_TYPE_LABELS[note.noteType]}</p>
              <p className="mt-1 whitespace-pre-wrap text-zinc-700">{note.content}</p>
            </li>
          ))
        )}
      </ul>

      <form onSubmit={onSubmit} className="space-y-3 border-t border-zinc-100 pt-4">
        <select
          value={noteType}
          onChange={(event) => setNoteType(event.target.value as MedicalNoteType)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          {NOTE_TYPES.map((value) => (
            <option key={value} value={value}>
              {NOTE_TYPE_LABELS[value]}
            </option>
          ))}
        </select>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          required
          rows={3}
          placeholder="הערה רפואית שנכתבה על ידי הצוות"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "שומר..." : "הוסף הערה"}
        </button>
      </form>
    </div>
  );
}
