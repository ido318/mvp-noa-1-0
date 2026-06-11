import Link from "next/link";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import { VisitForm } from "@/app/dashboard/visits/visit-form";
import type { MeResponse } from "@/types/api/me";
import type { Appointment } from "@/types/domain/appointment";
import type { Customer } from "@/types/domain/customer";
import type { Pet } from "@/types/domain/pet";

type SearchParams = Promise<{
  petId?: string;
  customerId?: string;
  appointmentId?: string;
}>;

export default async function NewVisitPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const context = await dashboardApiFetch<MeResponse>("/api/me");
  const clinicId =
    context?.profile.defaultClinicId ?? context?.memberships[0]?.clinicId ?? null;

  let customerId = params.customerId ?? null;
  let petId = params.petId ?? null;
  let appointmentId = params.appointmentId ?? null;

  if (appointmentId) {
    const appointment = await dashboardApiFetch<Appointment>(
      `/api/appointments/${appointmentId}`,
    );
    if (appointment) {
      customerId = appointment.customerId;
      petId = appointment.petId;
      appointmentId = appointment.id;
    }
  }

  if (petId && !customerId) {
    const pet = await dashboardApiFetch<Pet>(`/api/pets/${petId}`);
    customerId = pet?.customerId ?? null;
  }

  if (!customerId || !petId) {
    const customersData = await dashboardApiFetch<{ items: Customer[] }>("/api/customers");
    const firstCustomer = customersData?.items[0] ?? null;
    const petsData = firstCustomer
      ? await dashboardApiFetch<{ items: Pet[] }>(`/api/customers/${firstCustomer.id}/pets`)
      : null;
    customerId = customerId ?? firstCustomer?.id ?? null;
    petId = petId ?? petsData?.items[0]?.id ?? null;
  }

  if (!clinicId || !customerId || !petId) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        To create a visit, ensure at least one customer and one pet exist in the selected
        clinic.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <Link href="/dashboard/visits" className="text-sm text-emerald-700">
          ← Back to visits
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-zinc-900">New visit</h2>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <VisitForm
          clinicId={clinicId}
          customerId={customerId}
          petId={petId}
          appointmentId={appointmentId}
        />
      </div>
    </section>
  );
}
