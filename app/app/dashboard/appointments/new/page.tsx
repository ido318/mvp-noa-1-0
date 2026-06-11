import Link from "next/link";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import { AppointmentForm } from "@/app/dashboard/appointments/appointment-form";
import type { MeResponse } from "@/types/api/me";
import type { Customer } from "@/types/domain/customer";
import type { Pet } from "@/types/domain/pet";

export default async function NewAppointmentPage() {
  const context = await dashboardApiFetch<MeResponse>("/api/me");
  const clinicId =
    context?.profile.defaultClinicId ?? context?.memberships[0]?.clinicId ?? null;
  const customersData = await dashboardApiFetch<{ items: Customer[] }>("/api/customers");
  const firstCustomer = customersData?.items[0] ?? null;
  const petsData = firstCustomer
    ? await dashboardApiFetch<{ items: Pet[] }>(
        `/api/customers/${firstCustomer.id}/pets`,
      )
    : null;
  const firstPet = petsData?.items[0] ?? null;

  if (!clinicId || !firstCustomer || !firstPet) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        To create an appointment, ensure at least one customer and one pet exist
        in the selected clinic.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <Link href="/dashboard/appointments" className="text-sm text-emerald-700">
          ← Back to appointments
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-zinc-900">New appointment</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Customer: {firstCustomer.fullName} · Pet: {firstPet.name}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <AppointmentForm
          clinicId={clinicId}
          customerId={firstCustomer.id}
          petId={firstPet.id}
        />
      </div>
    </section>
  );
}
