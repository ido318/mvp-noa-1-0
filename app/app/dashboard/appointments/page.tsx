import Link from "next/link";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import { formatIsraelDateTime } from "@/lib/israel-date";
import type { Appointment } from "@/types/domain/appointment";

type SearchParams = Promise<{ clinicId?: string; date?: string; view?: "day" | "week" }>;

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const date = params.date ?? new Date().toISOString().slice(0, 10);
  const view = params.view ?? "day";
  const clinicId = params.clinicId;
  const endpoint = clinicId
    ? `/api/appointments?clinicId=${encodeURIComponent(clinicId)}&date=${encodeURIComponent(date)}&view=${view}`
    : `/api/appointments?date=${encodeURIComponent(date)}&view=${view}`;
  const response = await dashboardApiFetch<{ items: Appointment[] }>(endpoint);
  const items = response?.items ?? [];

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-900">Appointments</h2>
        <Link
          href="/dashboard/calendar?newAppointment=1"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
        >
          New appointment
        </Link>
      </div>

      <form action="/dashboard/appointments" className="flex gap-2">
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

      <div className="rounded-2xl border border-zinc-200 bg-white">
        <ul className="divide-y divide-zinc-200">
          {items.length === 0 ? (
            <li className="p-4 text-sm text-zinc-500">No appointments found.</li>
          ) : (
            items.map((appointment) => (
              <li key={appointment.id} className="p-4">
                <Link
                  href={`/dashboard/appointments/${appointment.id}`}
                  className="font-medium text-zinc-900 hover:text-emerald-700"
                >
                  {formatIsraelDateTime(appointment.scheduledAt)} ·{" "}
                  {appointment.appointmentType}
                </Link>
                <p className="text-sm text-zinc-600">
                  status: {appointment.status} · duration: {appointment.durationMinutes}m
                </p>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
