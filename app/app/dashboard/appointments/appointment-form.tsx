"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AppointmentSource,
  AppointmentType,
} from "@/types/domain/appointment";
import { effectiveDuration, VISIT_TYPE_CONFIG } from "@/lib/appointment-rules";

const APPOINTMENT_TYPES: AppointmentType[] = [
  "checkup",
  "home_visit",
  "vaccination",
  "phone_consultation",
  "neutering",
  "consultation",
  "urgent",
  "follow_up",
  "other",
];

const APPOINTMENT_SOURCES: AppointmentSource[] = [
  "phone",
  "front_desk",
  "online",
  "internal",
  "other",
];

type Props = {
  clinicId: string;
  customerId: string;
  petId: string;
};

export function AppointmentForm({ clinicId, customerId, petId }: Props) {
  const router = useRouter();
  const [scheduledAt, setScheduledAt] = useState("");
  const [appointmentType, setAppointmentType] =
    useState<AppointmentType>("checkup");
  const [source, setSource] = useState<AppointmentSource>("front_desk");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinicId,
        customerId,
        petId,
        appointmentType,
        source,
        scheduledAt: new Date(scheduledAt).toISOString(),
        durationMinutes: effectiveDuration(appointmentType),
        reason: reason || null,
        notes: notes || null,
      }),
    });

    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      setError(payload.error?.message ?? "Failed to create appointment");
      return;
    }

    router.push("/dashboard/appointments");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="scheduledAt" className="mb-1 block text-sm font-medium text-zinc-700">
          Scheduled at
        </label>
        <input
          id="scheduledAt"
          type="datetime-local"
          required
          value={scheduledAt}
          onChange={(event) => setScheduledAt(event.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="appointmentType" className="mb-1 block text-sm font-medium text-zinc-700">
          Appointment type
        </label>
        <select
          id="appointmentType"
          value={appointmentType}
          onChange={(event) => setAppointmentType(event.target.value as AppointmentType)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          {APPOINTMENT_TYPES.map((value) => (
            <option key={value} value={value}>
              {VISIT_TYPE_CONFIG[value].labelHe}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="source" className="mb-1 block text-sm font-medium text-zinc-700">
          Source
        </label>
        <select
          id="source"
          value={source}
          onChange={(event) => setSource(event.target.value as AppointmentSource)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          {APPOINTMENT_SOURCES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="reason" className="mb-1 block text-sm font-medium text-zinc-700">
          Reason
        </label>
        <input
          id="reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium text-zinc-700">
          Notes
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          rows={3}
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {loading ? "Creating..." : "Create appointment"}
      </button>
    </form>
  );
}
