import Link from "next/link";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import { formatIsraelDateTime } from "@/lib/israel-date";
import type { VoiceCall } from "@/types/domain/voice-call";

const CALL_STATUS_LABELS: Record<string, string> = {
  ringing: "מצלצל",
  in_progress: "בשיחה",
  completed: "הושלם",
  failed: "נכשל",
  busy: "תפוס",
  no_answer: "אין מענה",
  canceled: "בוטל",
  queued: "בתור",
};

const CALL_DIRECTION_LABELS: Record<string, string> = {
  inbound: "נכנסת",
  outbound: "יוצאת",
};

export default async function VoiceCallDetailPage({
  params,
}: {
  params: Promise<{ callId: string }>;
}) {
  const { callId } = await params;
  const call = await dashboardApiFetch<VoiceCall>(`/api/voice/calls/${callId}`);

  if (!call) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-zinc-600">השיחה לא נמצאה.</p>
        <Link href="/dashboard/voice" className="text-sm text-emerald-700">
          חזרה לשיחות
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <Link href="/dashboard/voice" className="text-sm text-emerald-700">
          חזרה לשיחות
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-zinc-900">פרטי שיחה</h2>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-3 text-sm">
        <p>
          <span className="font-medium text-zinc-700">מאת:</span> {call.fromNumber}
        </p>
        <p>
          <span className="font-medium text-zinc-700">אל:</span> {call.toNumber}
        </p>
        <p>
          <span className="font-medium text-zinc-700">סטטוס:</span>{" "}
          {CALL_STATUS_LABELS[call.status] ?? call.status}
        </p>
        <p>
          <span className="font-medium text-zinc-700">כיוון:</span>{" "}
          {CALL_DIRECTION_LABELS[call.direction] ?? call.direction}
        </p>
        <p>
            <span className="font-medium text-zinc-700">התחילה:</span>{" "}
          {formatIsraelDateTime(call.startedAt)}
        </p>
        {call.endedAt ? (
          <p>
            <span className="font-medium text-zinc-700">הסתיימה:</span>{" "}
            {formatIsraelDateTime(call.endedAt)}
          </p>
        ) : null}
        {call.durationSeconds != null ? (
          <p>
            <span className="font-medium text-zinc-700">משך:</span>{" "}
            {call.durationSeconds} שניות
          </p>
        ) : null}
        <p>
          <span className="font-medium text-zinc-700">Twilio SID:</span> {call.twilioCallSid}
        </p>
        {call.customerId ? (
          <p>
            <span className="font-medium text-zinc-700">לקוח:</span>{" "}
            <Link
              href={`/dashboard/customers/${call.customerId}`}
              className="text-emerald-700 hover:underline"
            >
              הצג לקוח
            </Link>
          </p>
        ) : (
          <p className="text-zinc-500">לא נמצא לקוח שתואם למספר המתקשר.</p>
        )}
        {call.recordingUrl ? (
          <p>
            <span className="font-medium text-zinc-700">הקלטה:</span>{" "}
            <a
              href={call.recordingUrl}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-700 hover:underline"
            >
              פתח הקלטה
            </a>
          </p>
        ) : null}
      </div>
    </section>
  );
}
