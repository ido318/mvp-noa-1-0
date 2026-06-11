import Link from "next/link";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import type { Customer } from "@/types/domain/customer";
import type { Pet } from "@/types/domain/pet";

type Params = { params: Promise<{ customerId: string }> };

export default async function CustomerDetailPage({ params }: Params) {
  const { customerId } = await params;
  const customer = await dashboardApiFetch<Customer>(`/api/customers/${customerId}`);
  const petsResponse = await dashboardApiFetch<{ items: Pet[] }>(
    `/api/customers/${customerId}/pets`,
  );
  const pets = petsResponse?.items ?? [];

  if (!customer) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Customer not found.
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <Link href="/dashboard/customers" className="text-sm text-emerald-700">
          ← Back to customers
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-zinc-900">{customer.fullName}</h2>
        <p className="text-sm text-zinc-600">
          {customer.phone ?? "No phone"} · {customer.email ?? "No email"}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Notes</h3>
        <p className="mt-2 text-sm text-zinc-700">{customer.notes ?? "No notes yet."}</p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Pets</h3>
        <ul className="mt-3 space-y-2">
          {pets.length === 0 ? (
            <li className="text-sm text-zinc-500">No pets for this customer.</li>
          ) : (
            pets.map((pet) => (
              <li key={pet.id}>
                <Link href={`/dashboard/pets/${pet.id}`} className="text-emerald-700">
                  {pet.name} ({pet.species})
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
