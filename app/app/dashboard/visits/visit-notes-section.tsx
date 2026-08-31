"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/dashboard/ui/btn";
import { Badge } from "@/components/dashboard/ui/badge";
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
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/visits/${visitId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        noteType,
        content,
        subjective: subjective || null,
        objective: objective || null,
        assessment: assessment || null,
        plan: plan || null,
      }),
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
    setSubjective("");
    setObjective("");
    setAssessment("");
    setPlan("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {initialNotes.length === 0 ? (
          <li className="text-sm text-[var(--faint)]">אין עדיין הערות.</li>
        ) : (
          initialNotes.map((note) => (
            <li key={note.id} className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3 text-sm">
              <Badge color="muted">{NOTE_TYPE_LABELS[note.noteType]}</Badge>
              <p className="mt-1.5 whitespace-pre-wrap text-[var(--ink)]">{note.content}</p>
              {(note.subjective || note.objective || note.assessment || note.plan) && (
                <dl className="mt-3 grid gap-2 text-xs text-[var(--ink-2)] sm:grid-cols-2">
                  {note.subjective && <div><dt className="font-bold">S</dt><dd className="whitespace-pre-wrap">{note.subjective}</dd></div>}
                  {note.objective && <div><dt className="font-bold">O</dt><dd className="whitespace-pre-wrap">{note.objective}</dd></div>}
                  {note.assessment && <div><dt className="font-bold">A</dt><dd className="whitespace-pre-wrap">{note.assessment}</dd></div>}
                  {note.plan && <div><dt className="font-bold">P</dt><dd className="whitespace-pre-wrap">{note.plan}</dd></div>}
                </dl>
              )}
            </li>
          ))
        )}
      </ul>

      <form onSubmit={onSubmit} className="space-y-3 border-t border-[var(--line-2)] pt-4">
        <select
          value={noteType}
          onChange={(event) => setNoteType(event.target.value as MedicalNoteType)}
          className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-400)]"
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
          className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-400)]"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <textarea
            value={subjective}
            onChange={(event) => setSubjective(event.target.value)}
            rows={2}
            placeholder="subjective"
            className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-400)]"
          />
          <textarea
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
            rows={2}
            placeholder="objective"
            className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-400)]"
          />
          <textarea
            value={assessment}
            onChange={(event) => setAssessment(event.target.value)}
            rows={2}
            placeholder="assessment"
            className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-400)]"
          />
          <textarea
            value={plan}
            onChange={(event) => setPlan(event.target.value)}
            rows={2}
            placeholder="plan"
            className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-400)]"
          />
        </div>
        {error ? <p className="text-sm font-semibold text-[var(--red-700)]">{error}</p> : null}
        <Btn type="submit" size="sm" loading={loading}>הוסף הערה</Btn>
      </form>
    </div>
  );
}
