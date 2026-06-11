import { dashboardApiFetch } from "@/app/dashboard/api-client";
import type { Appointment } from "@/types/domain/appointment";
import type { CalendarAvailabilityResponse } from "@/types/api/appointments";
import type { MeResponse } from "@/types/api/me";

type SearchParams = Promise<{ date?: string; view?: "day" | "week" }>;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const date = params.date ?? new Date().toISOString().slice(0, 10);
  const view = params.view ?? "day";
  const me = await dashboardApiFetch<MeResponse>("/api/me");
  const clinicId = me?.profile.defaultClinicId ?? me?.memberships[0]?.clinicId ?? "";

  const appointments = clinicId
    ? await dashboardApiFetch<{ items: Appointment[] }>(
        `/api/calendar?clinicId=${encodeURIComponent(clinicId)}&date=${encodeURIComponent(
          date,
        )}&view=${view}`,
      )
    : null;
  const availability = clinicId
    ? await dashboardApiFetch<CalendarAvailabilityResponse>(
        `/api/calendar/availability?clinicId=${encodeURIComponent(
          clinicId,
        )}&date=${encodeURIComponent(date)}`,
      )
    : null;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">Calendar</h2>
        <p className="mt-1 text-sm text-zinc-600">Basic {view} view with 30-minute slots.</p>
      </div>

      <form action="/dashboard/calendar" className="flex gap-2">
        <input
          type="date"
          name="date"
          defaultValue={date}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <select
          name="view"
          defaultValue={view}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="day">day</option>
          <option value="week">week</option>
        </select>
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700"
        >
          Apply
        </button>
      </form>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Appointments
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-zinc-700">
          {(appointments?.items ?? []).length === 0 ? (
            <li className="text-zinc-500">No appointments for selected scope.</li>
          ) : (
            (appointments?.items ?? []).map((appointment) => (
              <li key={appointment.id}>
                {new Date(appointment.scheduledAt).toLocaleString()} · {appointment.appointmentType} ·{" "}
                {appointment.status}
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Availability (single date)
        </h3>
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          {(availability?.availableSlots ?? []).length === 0 ? (
            <li className="text-zinc-500">No available slots.</li>
          ) : (
            (availability?.availableSlots ?? []).map((slot) => (
              <li key={slot} className="rounded border border-zinc-200 px-2 py-1">
                {new Date(slot).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
