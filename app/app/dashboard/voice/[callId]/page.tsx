import Link from "next/link";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import type { VoiceCall } from "@/types/domain/voice-call";

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
        <p className="text-sm text-zinc-600">Voice call not found.</p>
        <Link href="/dashboard/voice" className="text-sm text-emerald-700">
          Back to calls
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <Link href="/dashboard/voice" className="text-sm text-emerald-700">
          ← Back to calls
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-zinc-900">Voice call detail</h2>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-3 text-sm">
        <p>
          <span className="font-medium text-zinc-700">From:</span> {call.fromNumber}
        </p>
        <p>
          <span className="font-medium text-zinc-700">To:</span> {call.toNumber}
        </p>
        <p>
          <span className="font-medium text-zinc-700">Status:</span> {call.status}
        </p>
        <p>
          <span className="font-medium text-zinc-700">Direction:</span> {call.direction}
        </p>
        <p>
          <span className="font-medium text-zinc-700">Started:</span>{" "}
          {new Date(call.startedAt).toLocaleString()}
        </p>
        {call.endedAt ? (
          <p>
            <span className="font-medium text-zinc-700">Ended:</span>{" "}
            {new Date(call.endedAt).toLocaleString()}
          </p>
        ) : null}
        {call.durationSeconds != null ? (
          <p>
            <span className="font-medium text-zinc-700">Duration:</span>{" "}
            {call.durationSeconds}s
          </p>
        ) : null}
        <p>
          <span className="font-medium text-zinc-700">Twilio SID:</span> {call.twilioCallSid}
        </p>
        {call.customerId ? (
          <p>
            <span className="font-medium text-zinc-700">Customer:</span>{" "}
            <Link
              href={`/dashboard/customers/${call.customerId}`}
              className="text-emerald-700 hover:underline"
            >
              View customer
            </Link>
          </p>
        ) : (
          <p className="text-zinc-500">No matching customer for caller ID.</p>
        )}
        {call.recordingUrl ? (
          <p>
            <span className="font-medium text-zinc-700">Recording:</span>{" "}
            <a
              href={call.recordingUrl}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-700 hover:underline"
            >
              Open recording
            </a>
          </p>
        ) : null}
      </div>
    </section>
  );
}
