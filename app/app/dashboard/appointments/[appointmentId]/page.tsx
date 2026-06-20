import Link from "next/link";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import { AppointmentActions } from "@/app/dashboard/appointments/appointment-actions";
import { formatIsraelDateTime } from "@/lib/israel-date";
import type { Appointment } from "@/types/domain/appointment";

type Params = { params: Promise<{ appointmentId: string }> };

export default async function AppointmentDetailPage({ params }: Params) {
  const { appointmentId } = await params;
  const appointment = await dashboardApiFetch<Appointment>(`/api/appointments/${appointmentId}`);

  if (!appointment) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Appointment not found.
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <Link href="/dashboard/appointments" className="text-sm text-emerald-700">
          ← Back to appointments
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-zinc-900">
          {formatIsraelDateTime(appointment.scheduledAt)}
        </h2>
        <p className="text-sm text-zinc-600">
          {appointment.appointmentType} · {appointment.status}
        </p>
        {(appointment.status === "confirmed" || appointment.status === "completed") && (
          <Link
            href={`/dashboard/visits/new?appointmentId=${encodeURIComponent(appointment.id)}`}
            className="mt-3 inline-block rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
          >
            Start visit
          </Link>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <dl className="grid gap-3 text-sm text-zinc-700 sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Clinic</dt>
            <dd>{appointment.clinicId}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Customer</dt>
            <dd>{appointment.customerId}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Pet</dt>
            <dd>{appointment.petId}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Source</dt>
            <dd>{appointment.source}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Duration</dt>
            <dd>{appointment.durationMinutes}m</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Version</dt>
            <dd>{appointment.version}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Actions</h3>
        <div className="mt-3">
          <AppointmentActions
            appointmentId={appointment.id}
            currentVersion={appointment.version}
            currentStatus={appointment.status}
          />
        </div>
      </div>
    </section>
  );
}
