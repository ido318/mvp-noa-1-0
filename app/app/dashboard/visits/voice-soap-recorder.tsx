"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/dashboard/ui/btn";
import { PlayIcon } from "@/components/dashboard/icons";

// Preferred first — matches the soap-recordings bucket's .webm path
// convention (see app/api/visits/[visitId]/soap-recording/route.ts).
const RECORDING_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm"];

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  for (const candidate of RECORDING_MIME_CANDIDATES) {
    if (typeof MediaRecorder.isTypeSupported !== "function" || MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return "audio/webm";
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return payload?.error?.message ?? fallback;
}

const textareaClass =
  "w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-400)]";

type SoapDraftFields = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

const EMPTY_FIELDS: SoapDraftFields = {
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
};

// Order here also drives the composed note content below.
const SOAP_FIELD_LABELS: Record<keyof SoapDraftFields, string> = {
  subjective: "סובייקטיבי",
  objective: "אובייקטיבי",
  assessment: "הערכה",
  plan: "תוכנית טיפול",
};

/**
 * Builds a readable Hebrew-labeled content block from the (possibly
 * hand-edited) SOAP fields, mirroring the section-labeling convention
 * used server-side in ai-artifact.service.ts's buildSoapDraftText — but
 * plain text, not the raw structuredPayload JSON.
 */
function composeNoteContent(fields: SoapDraftFields): string {
  return (Object.keys(SOAP_FIELD_LABELS) as (keyof SoapDraftFields)[])
    .map((key) => `${SOAP_FIELD_LABELS[key]}:\n${fields[key].trim()}`)
    .join("\n\n");
}

/**
 * Lazy-load-signed-url-then-render-audio-tag, mirroring calls/page.tsx's
 * AudioPlayer component for call recordings.
 */
function SoapRecordingPlayer({ visitId, storagePath }: { visitId: string; storagePath: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function load() {
    if (url || loading) return;
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(
        `/api/visits/${visitId}/soap-recording?path=${encodeURIComponent(storagePath)}`,
      );
      if (!response.ok) throw new Error("failed");
      const payload = (await response.json()) as { data: { url: string } };
      setUrl(payload.data.url);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (error) return <p className="text-xs text-[var(--muted)]">ההקלטה אינה זמינה</p>;

  if (!url) {
    return (
      <button
        type="button"
        className="flex items-center gap-1.5 rounded-full bg-[var(--brand-50)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-700)] transition hover:bg-[var(--brand-100)]"
        onClick={() => void load()}
        disabled={loading}
      >
        {loading ? (
          <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : (
          <PlayIcon size={12} />
        )}
        {loading ? "טוען…" : "נגן הקלטה"}
      </button>
    );
  }

  return (
    <audio
      src={url}
      controls
      className="w-full h-8 rounded-lg"
      style={{ accentColor: "var(--brand-500)" }}
    />
  );
}

type Stage = "idle" | "recording" | "processing" | "review";

export function VoiceSoapRecorder({ visitId }: { visitId: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [processingLabel, setProcessingLabel] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [artifactId, setArtifactId] = useState<string | null>(null);
  const [fields, setFields] = useState<SoapDraftFields>(EMPTY_FIELDS);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("audio/webm");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Release the mic and stop the timer if the workspace navigates away
  // mid-recording.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function resetToIdle() {
    setStage("idle");
    setProcessingLabel("");
    setElapsedSeconds(0);
    setError(null);
    setStoragePath(null);
    setArtifactId(null);
    setFields(EMPTY_FIELDS);
    setSaveError(null);
    setSaving(false);
    chunksRef.current = [];
  }

  async function startRecording() {
    setError(null);

    if (
      typeof window === "undefined" ||
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError("הדפדפן אינו תומך בהקלטת שמע");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("לא ניתן לגשת למיקרופון. יש לאשר הרשאת הקלטה בדפדפן.");
      return;
    }

    const mimeType = pickSupportedMimeType();
    mimeTypeRef.current = mimeType;
    chunksRef.current = [];

    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      void handleRecordingStopped();
    };

    streamRef.current = stream;
    mediaRecorderRef.current = recorder;
    recorder.start();

    setElapsedSeconds(0);
    setStage("recording");
    timerRef.current = setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);
  }

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }

  async function handleRecordingStopped() {
    setStage("processing");
    setProcessingLabel("מעלה הקלטה...");

    const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || "audio/webm" });
    chunksRef.current = [];

    const formData = new FormData();
    formData.append("file", blob, "recording.webm");

    let uploadedPath: string;
    try {
      const uploadResponse = await fetch(`/api/visits/${visitId}/soap-recording`, {
        method: "POST",
        body: formData,
      });
      if (!uploadResponse.ok) {
        setError(await readErrorMessage(uploadResponse, "העלאת ההקלטה נכשלה"));
        setStage("idle");
        return;
      }
      const uploadPayload = (await uploadResponse.json()) as { data: { storagePath: string } };
      uploadedPath = uploadPayload.data.storagePath;
    } catch {
      setError("העלאת ההקלטה נכשלה");
      setStage("idle");
      return;
    }

    setStoragePath(uploadedPath);
    setProcessingLabel("מתמלל ומנתח...");

    try {
      const draftResponse = await fetch(`/api/visits/${visitId}/soap-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath: uploadedPath }),
      });
      if (!draftResponse.ok) {
        setError(await readErrorMessage(draftResponse, "ניתוח ההקלטה נכשל"));
        setStage("idle");
        return;
      }
      const draftPayload = (await draftResponse.json()) as {
        data: {
          id: string;
          structuredPayload?: {
            subjective?: string;
            objective?: string;
            assessment?: string;
            plan?: string;
          };
        };
      };

      setArtifactId(draftPayload.data.id);
      setFields({
        subjective: draftPayload.data.structuredPayload?.subjective ?? "",
        objective: draftPayload.data.structuredPayload?.objective ?? "",
        assessment: draftPayload.data.structuredPayload?.assessment ?? "",
        plan: draftPayload.data.structuredPayload?.plan ?? "",
      });
      setStage("review");
    } catch {
      setError("ניתוח ההקלטה נכשל");
      setStage("idle");
    }
  }

  async function onAddAsNote() {
    setSaving(true);
    setSaveError(null);

    const response = await fetch(`/api/visits/${visitId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // "soap_full" (as an earlier plan draft assumed) is not a valid
        // MedicalNoteType — see lib/validators/medical-note.ts. "general"
        // is the closest existing type for a single note that carries all
        // four SOAP sections at once; it's also the default noteType the
        // manual create-note form in VisitNotesSection starts from.
        noteType: "general",
        content: composeNoteContent(fields),
        subjective: fields.subjective.trim() || null,
        objective: fields.objective.trim() || null,
        assessment: fields.assessment.trim() || null,
        plan: fields.plan.trim() || null,
      }),
    });

    if (!response.ok) {
      setSaveError(await readErrorMessage(response, "הוספת ההערה נכשלה"));
      setSaving(false);
      return;
    }

    // Best-effort: the note itself was already created successfully, so a
    // failure here (marking the originating AI artifact as reviewed) must
    // not block the user or show a scary error — it's an audit nicety, not
    // the primary action.
    if (artifactId) {
      try {
        const approveResponse = await fetch(`/api/ai/artifacts/${artifactId}/approve`, {
          method: "POST",
        });
        if (!approveResponse.ok) {
          console.warn("[voice-soap-recorder] failed to mark AI artifact as reviewed", artifactId);
        }
      } catch (approveError) {
        console.warn("[voice-soap-recorder] failed to mark AI artifact as reviewed", approveError);
      }
    }

    router.refresh();
    resetToIdle();
  }

  return (
    <div className="space-y-3 border-b border-[var(--line-2)] pb-4 mb-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        הקלטת SOAP קולית
      </p>

      {stage === "idle" && (
        <Btn type="button" size="sm" onClick={() => void startRecording()}>
          הקלטה
        </Btn>
      )}

      {stage === "recording" && (
        <div className="flex items-center gap-3">
          <Btn type="button" variant="danger" size="sm" onClick={stopRecording}>
            עצור הקלטה
          </Btn>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--red-700)]">
            <span className="h-2 w-2 rounded-full bg-[var(--red-500)] animate-[pulseRing_2s_ease-in-out_infinite]" />
            מקליט… {formatElapsed(elapsedSeconds)}
          </span>
        </div>
      )}

      {stage === "processing" && (
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
          {processingLabel}
        </div>
      )}

      {stage === "review" && (
        <div className="space-y-3">
          {storagePath ? <SoapRecordingPlayer visitId={visitId} storagePath={storagePath} /> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[var(--ink-2)]">
                {SOAP_FIELD_LABELS.subjective}
              </span>
              <textarea
                value={fields.subjective}
                onChange={(event) => setFields((prev) => ({ ...prev, subjective: event.target.value }))}
                rows={3}
                className={textareaClass}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[var(--ink-2)]">
                {SOAP_FIELD_LABELS.objective}
              </span>
              <textarea
                value={fields.objective}
                onChange={(event) => setFields((prev) => ({ ...prev, objective: event.target.value }))}
                rows={3}
                className={textareaClass}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[var(--ink-2)]">
                {SOAP_FIELD_LABELS.assessment}
              </span>
              <textarea
                value={fields.assessment}
                onChange={(event) => setFields((prev) => ({ ...prev, assessment: event.target.value }))}
                rows={3}
                className={textareaClass}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[var(--ink-2)]">{SOAP_FIELD_LABELS.plan}</span>
              <textarea
                value={fields.plan}
                onChange={(event) => setFields((prev) => ({ ...prev, plan: event.target.value }))}
                rows={3}
                className={textareaClass}
              />
            </label>
          </div>

          {saveError ? <p className="text-sm font-semibold text-[var(--red-700)]">{saveError}</p> : null}

          <div className="flex gap-2">
            <Btn type="button" size="sm" loading={saving} onClick={() => void onAddAsNote()}>
              הוסף כהערה
            </Btn>
            <Btn type="button" variant="ghost" size="sm" onClick={resetToIdle} disabled={saving}>
              בטל
            </Btn>
          </div>
        </div>
      )}

      {error ? <p className="text-sm font-semibold text-[var(--red-700)]">{error}</p> : null}
    </div>
  );
}
