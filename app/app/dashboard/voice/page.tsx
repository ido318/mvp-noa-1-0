import Link from "next/link";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import type { VoiceCall } from "@/types/domain/voice-call";

type SearchParams = Promise<{ clinicId?: string; status?: string }>;

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

export default async function VoiceCallsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.clinicId) query.set("clinicId", params.clinicId);
  if (params.status) query.set("status", params.status);
  const endpoint = `/api/voice/calls${query.size ? `?${query.toString()}` : ""}`;
  const response = await dashboardApiFetch<{ items: VoiceCall[] }>(endpoint);
  const items = response?.items ?? [];

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-900">שיחות</h2>
      </div>

      <form action="/dashboard/voice" className="flex gap-2">
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">כל הסטטוסים</option>
          <option value="ringing">{CALL_STATUS_LABELS.ringing}</option>
          <option value="in_progress">{CALL_STATUS_LABELS.in_progress}</option>
          <option value="completed">{CALL_STATUS_LABELS.completed}</option>
          <option value="failed">{CALL_STATUS_LABELS.failed}</option>
          <option value="busy">{CALL_STATUS_LABELS.busy}</option>
          <option value="no_answer">{CALL_STATUS_LABELS.no_answer}</option>
          <option value="canceled">{CALL_STATUS_LABELS.canceled}</option>
        </select>
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700"
        >
          סנן
        </button>
      </form>

      <div className="rounded-2xl border border-zinc-200 bg-white">
        <ul className="divide-y divide-zinc-200">
          {items.length === 0 ? (
            <li className="p-4 text-sm text-zinc-500">לא נמצאו שיחות.</li>
          ) : (
            items.map((call) => (
              <li key={call.id} className="p-4">
                <Link
                  href={`/dashboard/voice/${call.id}`}
                  className="font-medium text-zinc-900 hover:text-emerald-700"
                >
                  {new Date(call.startedAt).toLocaleString()} · {call.fromNumber}
                </Link>
                <p className="text-sm text-zinc-600">
                  סטטוס: {CALL_STATUS_LABELS[call.status] ?? call.status} · כיוון:{" "}
                  {CALL_DIRECTION_LABELS[call.direction] ?? call.direction}
                  {call.customerId ? " · לקוח מקושר" : " · מתקשר לא מזוהה"}
                </p>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
